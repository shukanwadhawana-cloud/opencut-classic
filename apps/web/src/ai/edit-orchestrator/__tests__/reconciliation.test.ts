import { describe, expect, test } from "bun:test";
import type { FrameRate } from "opencut-wasm";
import type { SceneTracks, VideoElement } from "@/timeline/types";
import { runAiEditOnTracks } from "@/ai/edit-orchestrator";
import { executeEditPlan, AI_STABLE_ID_PARAM, collectExistingStableIds, snapshotTracks } from "@/ai/edit-executor";
import type { EditPlan } from "@/ai/edit-director/schema";
import type { DirectorTranscript } from "@/ai/edit-director";
import { transcriptionResultToDirectorTranscript } from "@/ai/edit-orchestrator/transcript-from-asr";

const FPS_30: FrameRate = { numerator: 30, denominator: 1 };
const DURATION = 120_000 * 30;

function makeTracks(): SceneTracks {
	const video: VideoElement = {
		id: "main-video-1", type: "video", name: "Talking head", mediaId: "media-source-1",
		startTime: 0 as VideoElement["startTime"], duration: DURATION as VideoElement["duration"],
		trimStart: 0 as VideoElement["trimStart"], trimEnd: 0 as VideoElement["trimEnd"],
		params: { "transform.scaleX": 1, "transform.scaleY": 1 },
	};
	return { main: { id: "main-track", name: "Main", type: "video", elements: [video], muted: false, hidden: false }, overlay: [], audio: [] };
}

function transcript(): DirectorTranscript {
	return {
		id: "t1", fullText: "This is important. Step 1 processes the input.",
		segments: [
			{ id: "s1", text: "This is important.", start: 0, end: 240_000 },
			{ id: "s2", text: "Step 1 processes the input.", start: 360_000, end: 720_000 },
		],
		status: "complete",
	};
}

describe("Phase 4.4", () => {
	test("ASR to ticks", () => {
		const doc = transcriptionResultToDirectorTranscript({
			result: { text: "Hi", language: "en", segments: [{ text: "Hi", start: 1.5, end: 2 }] },
		});
		expect(doc.segments[0].start).toBe(Math.round(1.5 * 120_000));
	});
	test("master immutable", () => {
		const tracks = makeTracks();
		const before = tracks.main.elements[0] as VideoElement;
		const result = runAiEditOnTracks({ transcript: transcript(), tracks, fps: FPS_30, durationTicks: DURATION, planId: "p1", now: "2026-01-01T00:00:00.000Z" });
		const after = result.tracks.main.elements[0] as VideoElement;
		expect(after.mediaId).toBe(before.mediaId);
		expect(after.startTime).toBe(before.startTime);
		expect(after.duration).toBe(before.duration);
	});
	test("idempotent", () => {
		const first = runAiEditOnTracks({ transcript: transcript(), tracks: makeTracks(), fps: FPS_30, durationTicks: DURATION, planId: "p2", now: "2026-01-01T00:00:00.000Z" });
		const second = runAiEditOnTracks({ transcript: transcript(), tracks: first.tracks, fps: FPS_30, durationTicks: DURATION, planId: "p2", now: "2026-01-01T00:00:00.000Z" });
		const count = (tr: SceneTracks) => tr.overlay.flatMap((t) => t.elements).length;
		expect(count(second.tracks)).toBe(count(first.tracks));
		expect(count(first.tracks)).toBeGreaterThan(0);
	});
	test("malicious master rejected", () => {
		const plan: EditPlan = {
			schemaVersion: 1, id: "evil", createdAt: "2026-01-01T00:00:00.000Z",
			source: { fps: FPS_30, durationTicks: DURATION, transcriptId: "t1" },
			edits: [{ id: "e1", type: "graphic", start: 0, end: 1000, priority: 1, reason: "x", target: "master" as "overlay", metadata: { graphicKind: "rectangle" } }],
			densityProfile: "balanced",
		};
		const ex = executeEditPlan({ context: { plan, projectFps: FPS_30, durationTicks: DURATION } });
		expect(ex.ok).toBe(false);
		expect(ex.blueprints).toHaveLength(0);
	});
	test("aiStableId round-trip JSON", () => {
		const result = runAiEditOnTracks({ transcript: transcript(), tracks: makeTracks(), fps: FPS_30, durationTicks: DURATION, planId: "p3", now: "2026-01-01T00:00:00.000Z" });
		const loaded = JSON.parse(snapshotTracks({ tracks: result.tracks })) as SceneTracks;
		const els = loaded.overlay.flatMap((t) => t.elements);
		expect(els.every((e) => typeof e.params?.[AI_STABLE_ID_PARAM] === "string")).toBe(true);
	});
});
