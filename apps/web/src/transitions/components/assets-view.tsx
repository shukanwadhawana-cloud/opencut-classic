"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/editor/use-editor";
import { UpsertKeyframeCommand } from "@/commands/timeline/element/keyframes/upsert-keyframe";
import { BatchCommand } from "@/commands/batch-command";
import type { MediaTime } from "@/wasm";
import { mediaTimeFromSeconds } from "@/wasm";
import type { VisualElement } from "@/timeline";

type TransitionKind = "fade-in" | "fade-out" | "crossfade";

const DEFAULT_FADE_SECONDS = 0.5;

function isVisual(
	element: { type: string } | undefined,
): element is VisualElement {
	return (
		!!element &&
		(element.type === "video" ||
			element.type === "image" ||
			element.type === "text" ||
			element.type === "graphic" ||
			element.type === "sticker")
	);
}

/**
 * Applies opacity keyframes on the selected visual element so fades affect
 * preview/export through the existing animation system.
 */
export function TransitionsView() {
	const editor = useEditor();

	const applyTransition = useCallback(
		({ kind }: { kind: TransitionKind }) => {
			const selection = editor.selection.getSelectedElements();
			const first = selection[0];
			if (!first) {
				toast.error("Select a clip on the timeline first");
				return;
			}

			const tracks = editor.scenes.getActiveScene().tracks;
			const track =
				tracks.main.id === first.trackId
					? tracks.main
					: tracks.overlay.find((t) => t.id === first.trackId) ??
						tracks.audio.find((t) => t.id === first.trackId);
			const element = track?.elements.find((e) => e.id === first.elementId);
			if (!isVisual(element)) {
				toast.error("Select a video, image, text, or graphic clip");
				return;
			}

			const durationSec = Math.max(
				0.05,
				(element.duration as number) / 120_000,
			);
			const fadeSec = Math.min(DEFAULT_FADE_SECONDS, durationSec / 2);
			const fadeTicks = mediaTimeFromSeconds({ seconds: fadeSec }) as MediaTime;
			const endLocal = element.duration as MediaTime;
			const fadeEnd = fadeTicks;
			const fadeStartOut = mediaTimeFromSeconds({
				seconds: Math.max(0, durationSec - fadeSec),
			}) as MediaTime;

			const commands = [];

			if (kind === "fade-in" || kind === "crossfade") {
				commands.push(
					new UpsertKeyframeCommand({
						trackId: first.trackId,
						elementId: first.elementId,
						propertyPath: "opacity",
						time: mediaTimeFromSeconds({ seconds: 0 }) as MediaTime,
						value: 0,
						interpolation: "linear",
					}),
					new UpsertKeyframeCommand({
						trackId: first.trackId,
						elementId: first.elementId,
						propertyPath: "opacity",
						time: fadeEnd,
						value: 1,
						interpolation: "linear",
					}),
				);
			}

			if (kind === "fade-out" || kind === "crossfade") {
				commands.push(
					new UpsertKeyframeCommand({
						trackId: first.trackId,
						elementId: first.elementId,
						propertyPath: "opacity",
						time: fadeStartOut,
						value: 1,
						interpolation: "linear",
					}),
					new UpsertKeyframeCommand({
						trackId: first.trackId,
						elementId: first.elementId,
						propertyPath: "opacity",
						time: endLocal,
						value: 0,
						interpolation: "linear",
					}),
				);
			}

			editor.command.execute({ command: new BatchCommand(commands) });
			toast.success(
				kind === "fade-in"
					? "Fade in applied"
					: kind === "fade-out"
						? "Fade out applied"
						: "Crossfade (in + out) applied",
			);
		},
		[editor],
	);

	return (
		<PanelView title="Transitions">
			<div className="flex flex-col gap-3 p-3 text-sm">
				<p className="text-muted-foreground text-xs">
					Select a clip, then apply a fade. Uses opacity keyframes on the
					selected element (preview + export).
				</p>
				<Button
					variant="secondary"
					className="justify-start"
					onClick={() => applyTransition({ kind: "fade-in" })}
				>
					Fade in
				</Button>
				<Button
					variant="secondary"
					className="justify-start"
					onClick={() => applyTransition({ kind: "fade-out" })}
				>
					Fade out
				</Button>
				<Button
					variant="secondary"
					className="justify-start"
					onClick={() => applyTransition({ kind: "crossfade" })}
				>
					Fade in + out
				</Button>
				<p className="text-muted-foreground text-xs">
					Default fade length: {DEFAULT_FADE_SECONDS}s (capped at half the clip).
				</p>
			</div>
		</PanelView>
	);
}
