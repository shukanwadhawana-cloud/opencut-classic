"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useEditor } from "@/editor/use-editor";
import type { ParamValues } from "@/params";
import type { VisualElement } from "@/timeline";

function isVisual(
	element: { type: string; params?: ParamValues } | undefined,
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

function readNumber(params: ParamValues | undefined, key: string, fallback: number) {
	const v = params?.[key];
	return typeof v === "number" ? v : fallback;
}

/**
 * Color/opacity adjustments for the selected visual element.
 * Opacity is rendered natively. brightness/contrast/saturation are stored on
 * params and applied in the compositor when supported.
 */
export function AdjustmentView() {
	const editor = useEditor();
	const selection = useEditor((e) => e.selection.getSelectedElements());

	const selected = useMemo(() => {
		const first = selection[0];
		if (!first) return null;
		const tracks = editor.scenes.getActiveScene().tracks;
		const track =
			tracks.main.id === first.trackId
				? tracks.main
				: tracks.overlay.find((t) => t.id === first.trackId);
		const element = track?.elements.find((e) => e.id === first.elementId);
		if (!isVisual(element)) return null;
		return { trackId: first.trackId, element };
	}, [editor, selection]);

	const patchParams = useCallback(
		({ key, value }: { key: string; value: number }) => {
			if (!selected) {
				toast.error("Select a clip on the timeline first");
				return;
			}
			const nextParams: ParamValues = {
				...(selected.element.params ?? {}),
				[key]: value,
			};
			editor.timeline.updateElements({
				updates: [
					{
						trackId: selected.trackId,
						elementId: selected.element.id,
						patch: { params: nextParams },
					},
				],
			});
		},
		[editor, selected],
	);

	if (!selected) {
		return (
			<PanelView title="Adjustment">
				<p className="text-muted-foreground p-3 text-xs">
					Select a video, image, text, or graphic on the timeline to adjust.
				</p>
			</PanelView>
		);
	}

	const opacity = readNumber(selected.element.params, "opacity", 1);
	const brightness = readNumber(selected.element.params, "brightness", 1);
	const contrast = readNumber(selected.element.params, "contrast", 1);
	const saturation = readNumber(selected.element.params, "saturation", 1);

	return (
		<PanelView title="Adjustment">
			<div className="flex flex-col gap-4 p-3">
				<AdjustmentSlider
					label="Opacity"
					value={opacity}
					min={0}
					max={1}
					step={0.01}
					onChange={(value) => patchParams({ key: "opacity", value })}
				/>
				<AdjustmentSlider
					label="Brightness"
					value={brightness}
					min={0.25}
					max={2}
					step={0.01}
					onChange={(value) => patchParams({ key: "brightness", value })}
				/>
				<AdjustmentSlider
					label="Contrast"
					value={contrast}
					min={0.25}
					max={2}
					step={0.01}
					onChange={(value) => patchParams({ key: "contrast", value })}
				/>
				<AdjustmentSlider
					label="Saturation"
					value={saturation}
					min={0}
					max={2}
					step={0.01}
					onChange={(value) => patchParams({ key: "saturation", value })}
				/>
				<p className="text-muted-foreground text-xs">
					Opacity always affects preview. Brightness/contrast/saturation are
					stored on the clip and applied when the renderer supports color
					filters.
				</p>
			</div>
		</PanelView>
	);
}

function AdjustmentSlider({
	label,
	value,
	min,
	max,
	step,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void;
}) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<Label className="text-xs">{label}</Label>
				<span className="text-muted-foreground text-xs tabular-nums">
					{value.toFixed(2)}
				</span>
			</div>
			<Slider
				value={[value]}
				min={min}
				max={max}
				step={step}
				onValueChange={(vals) => {
					const next = vals[0];
					if (typeof next === "number") onChange(next);
				}}
			/>
		</div>
	);
}
