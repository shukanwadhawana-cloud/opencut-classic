import { Input, ALL_FORMATS, BlobSource, AudioBufferSink } from "mediabunny";
import type { EditorCore } from "@/core";
import type { MediaAsset } from "@/media/types";
import { mediaTimeFromSeconds } from "@/wasm";
import { transcriptionService } from "@/services/transcription/service";
import { buildCaptionChunks } from "@/transcription/caption";
import { runAiEditOnTracks } from "@/ai/edit-orchestrator/run-ai-edit";
import { transcriptionResultToDirectorTranscript } from "@/ai/edit-orchestrator/transcript-from-asr";
import { buildTextElement } from "@/timeline/element-utils";
import { buildElementFromMedia } from "@/timeline/element-utils";
import type { VideoElement } from "@/timeline";

const TRANSCRIPTION_SAMPLE_RATE = 16000;
const MAX_CAPTION_WORDS = 5;
const MIN_BROLL_SECONDS = 1.5;
const MAX_BROLL_SECONDS = 4;

export interface AutoEditResult {
  transcriptSegments: number;
  captionsAdded: number;
  zoomsAndCalloutsApplied: number;
  brollAdded: number;
}

export async function runAutoEdit({
  editor,
  modelId = "whisper-small",
  onProgress,
}: {
  editor: EditorCore;
  modelId?: "whisper-tiny" | "whisper-small" | "whisper-medium" | "whisper-large-v3-turbo";
  onProgress?: (message: string) => void;
}): Promise<AutoEditResult> {
  const project = editor.project.getActive();
  if (!project) throw new Error("Open a project first.");

  let assets = editor.media.getAssets();
  let mainVideo = editor.scenes
    .getActiveScene()
    .tracks.main.elements.find((element): element is VideoElement => element.type === "video");

  if (!mainVideo) {
    const source = assets.find((asset) => asset.type === "video");
    if (!source) throw new Error("Import a video first.");
    onProgress?.("Putting your video on the timeline...");
    const duration = source.duration ?? 1;
    editor.timeline.insertElement({
      element: buildElementFromMedia({
        mediaId: source.id,
        mediaType: "video",
        name: source.name,
        duration: mediaTimeFromSeconds({ seconds: duration }),
        startTime: mediaTimeFromSeconds({ seconds: 0 }),
      }),
      placement: { mode: "auto" },
    });
    mainVideo = editor.scenes
      .getActiveScene()
      .tracks.main.elements.find((element): element is VideoElement => element.type === "video");
  }

  if (!mainVideo) throw new Error("Could not place the main video on the timeline.");

  assets = editor.media.getAssets();
  const sourceAsset = assets.find((asset) => asset.id === mainVideo.mediaId);
  if (!sourceAsset) throw new Error("The main video file is missing.");

  onProgress?.("Extracting speech...");
  const audio = await extractMonoAudio16k({ file: sourceAsset.file, onProgress });
  onProgress?.("Transcribing locally...");
  const result = await transcriptionService.transcribe({
    audioData: audio,
    modelId,
    onProgress: (p) => {
      if (p.message) onProgress?.(p.message);
    },
  });

  const directorTranscript = transcriptionResultToDirectorTranscript({
    result,
    documentId: `auto-${sourceAsset.id}`,
  });

  if (!result.segments.length) {
    throw new Error("No speech was detected in the video.");
  }

  const durationTicks = editor.timeline.getTotalDuration();
  const fps = project.settings.fps;
  const sceneBeforeAi = editor.scenes.getActiveScene();
  const aiResult = runAiEditOnTracks({
    transcript: directorTranscript,
    tracks: sceneBeforeAi.tracks,
    fps,
    durationTicks,
    allowMainTransformKeyframes: true,
  });
  if (aiResult.application) {
    editor.timeline.updateTracks(aiResult.application.tracks);
  }

  onProgress?.("Adding captions...");
  const captionChunks = buildCaptionChunks({
    segments: result.segments,
    wordsPerChunk: MAX_CAPTION_WORDS,
  });
  for (const chunk of captionChunks) {
    const startTime = mediaTimeFromSeconds({ seconds: chunk.startTime });
    const duration = mediaTimeFromSeconds({ seconds: Math.max(0.2, chunk.duration) });
    editor.timeline.insertElement({
      element: buildTextElement({
        startTime,
        raw: {
          name: "Auto Caption",
          duration,
          params: {
            content: chunk.text,
            fontSize: 42,
            fontFamily: "Arial",
            color: "#ffffff",
            textAlign: "center",
            fontWeight: "bold",
            "background.enabled": true,
            "background.color": "#000000",
            "background.cornerRadius": 12,
            "background.paddingX": 22,
            "background.paddingY": 14,
            "background.offsetY": 360,
          },
        },
      }),
      placement: { mode: "auto" },
    });
  }

  onProgress?.("Finding B-roll...");
  const brollAdded = addMatchingBroll({
    editor,
    assets,
    transcriptSegments: result.segments,
    mainMediaId: sourceAsset.id,
  });

  await editor.project.saveCurrentProject();
  onProgress?.("Done.");

  return {
    transcriptSegments: result.segments.length,
    captionsAdded: captionChunks.length,
    zoomsAndCalloutsApplied:
      (aiResult.application?.insertedElementIds.length ?? 0) +
      (aiResult.application?.appliedKeyframeIds.length ?? 0),
    brollAdded,
  };
}

async function extractMonoAudio16k({
  file,
  onProgress,
}: {
  file: File;
  onProgress?: (message: string) => void;
}): Promise<Float32Array> {
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });

  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error("This video has no audio track.");

    const sink = new AudioBufferSink(track);
    const chunks: AudioBuffer[] = [];
    let totalSamples = 0;

    for await (const { buffer } of sink.buffers(0)) {
      chunks.push(buffer);
      totalSamples += buffer.length;
      if (chunks.length % 8 === 0) onProgress?.("Reading audio...");
    }

    if (!chunks.length) throw new Error("Could not decode the video's audio.");

    const nativeRate = chunks[0].sampleRate;
    const mono = new Float32Array(totalSamples);
    let offset = 0;
    for (const buffer of chunks) {
      for (let i = 0; i < buffer.length; i++) {
        let value = 0;
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          value += buffer.getChannelData(channel)[i] ?? 0;
        }
        mono[offset + i] = value / buffer.numberOfChannels;
      }
      offset += buffer.length;
    }

    if (nativeRate === TRANSCRIPTION_SAMPLE_RATE) return mono;

    const outputLength = Math.ceil(
      mono.length * (TRANSCRIPTION_SAMPLE_RATE / nativeRate),
    );
    const offline = new OfflineAudioContext(
      1,
      outputLength,
      TRANSCRIPTION_SAMPLE_RATE,
    );
    const source = offline.createBufferSource();
    const sourceBuffer = offline.createBuffer(1, mono.length, nativeRate);
    sourceBuffer.copyToChannel(mono, 0);
    source.buffer = sourceBuffer;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    input.dispose();
  }
}

function addMatchingBroll({
  editor,
  assets,
  transcriptSegments,
  mainMediaId,
}: {
  editor: EditorCore;
  assets: MediaAsset[];
  transcriptSegments: Array<{ text: string; start: number; end: number }>;
  mainMediaId: string;
}): number {
  const candidates = assets.filter(
    (asset) =>
      asset.id !== mainMediaId &&
      (asset.type === "video" || asset.type === "image"),
  );
  if (!candidates.length) return 0;

  const stop = new Set([
    "the", "and", "for", "that", "this", "with", "from", "your", "you",
    "are", "was", "will", "have", "has", "into", "about", "what", "when",
    "then", "than", "they", "their", "there", "just", "also", "can",
  ]);

  const tokenise = (text: string) =>
    new Set(
      text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
        .filter((word) => word.length >= 4 && !stop.has(word)),
    );

  let inserted = 0;
  for (const segment of transcriptSegments) {
    const words = tokenise(segment.text);
    if (!words.size) continue;

    let best: { asset: MediaAsset; score: number } | null = null;
    for (const asset of candidates) {
      const nameWords = tokenise(asset.name);
      const score = [...words].filter((word) => nameWords.has(word)).length;
      if (score > (best?.score ?? 0)) best = { asset, score };
    }

    if (!best || best.score === 0) continue;

    const startSeconds = segment.start;
    const durationSeconds = Math.min(
      MAX_BROLL_SECONDS,
      Math.max(MIN_BROLL_SECONDS, segment.end - segment.start),
    );
    const duration = mediaTimeFromSeconds({ seconds: durationSeconds });
    editor.timeline.insertElement({
      element: buildElementFromMedia({
        mediaId: best.asset.id,
        mediaType: best.asset.type,
        name: `B-roll: ${best.asset.name}`,
        duration,
        startTime: mediaTimeFromSeconds({ seconds: startSeconds }),
      }),
      placement: { mode: "auto" },
    });
    inserted += 1;
  }

  return inserted;
}
