import type { EditorCore } from "@/core";
import { runAiEditOnTracks, type AiEditResult } from "./run-ai-edit";
import type { DirectorTranscript } from "@/ai/edit-director";
import type { FrameRate } from "opencut-wasm";
import { applyExecutionResultWithCommands } from "@/ai/edit-executor/apply-commands";
import {
	transcriptionResultToDirectorTranscript,
	TRANSCRIPT_TICKS_PER_SECOND,
} from "./transcript-from-asr";

export {
	transcriptionResultToDirectorTranscript,
	TRANSCRIPT_TICKS_PER_SECOND,
};

export function runAiEditInEditor({
	editor,
	transcript,
}: {
	editor: EditorCore;
	transcript: DirectorTranscript | null | undefined;
}): AiEditResult {
	const project = editor.project.getActive();
	const fps = project.settings.fps as FrameRate;
	const durationTicks =
		(editor.timeline.getTotalDuration() as number) ||
		(project.metadata.duration as number) ||
		0;
	const tracks = editor.scenes.getActiveScene().tracks;

	const planned = runAiEditOnTracks({
		transcript,
		tracks,
		fps,
		durationTicks,
	});

	if (
		!planned.execution ||
		(planned.execution.blueprints.length === 0 &&
			planned.execution.keyframes.length === 0)
	) {
		return planned;
	}

	try {
		applyExecutionResultWithCommands({
			result: planned.execution,
			tracks,
			execute: (command) => {
				editor.command.execute({ command });
			},
		});
		editor.save.markDirty();
		return {
			...planned,
			tracks: editor.scenes.getActiveScene().tracks,
		};
	} catch (error) {
		return {
			...planned,
			status: "validation_failed",
			message:
				error instanceof Error ? error.message : "Failed to apply AI edits",
			application: null,
			tracks,
		};
	}
}

export function getTranscriptFromProject({
	editor,
}: {
	editor: EditorCore;
}): DirectorTranscript | null {
	const project = editor.project.getActive() as {
		transcripts?: DirectorTranscript[];
	};
	const list = project.transcripts;
	if (!Array.isArray(list) || list.length === 0) return null;
	return list[0] ?? null;
}

export function storeTranscriptOnProject({
	editor,
	transcript,
}: {
	editor: EditorCore;
	transcript: DirectorTranscript;
}): void {
	const project = editor.project.getActive();
	const prev =
		(project as { transcripts?: DirectorTranscript[] }).transcripts ?? [];
	editor.project.setActiveProject({
		project: {
			...project,
			transcripts: [
				transcript,
				...prev.filter((t) => t.id !== transcript.id),
			],
		},
	});
	editor.save.markDirty();
}
