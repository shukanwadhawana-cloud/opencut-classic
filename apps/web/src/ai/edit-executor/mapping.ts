import type { EditInstruction } from "@/ai/edit-director/schema";
import type { KeyframeBlueprint, TimelineElementBlueprint } from "./types";
import { makeProvenance, makeStableElementId } from "./idempotency";
import { buildAiElementParams } from "./types";

export interface MapInstructionResult {
	blueprints: TimelineElementBlueprint[];
	keyframes: KeyframeBlueprint[];
	skipReason?: string;
	skipCode?: "unsupported_type" | "invalid_metadata" | "zero_duration" | "master_track_forbidden" | "renderer_unavailable";
}

function baseText(content: string, color: string, fontWeight: string, fontSize: number, y: number) {
	return {
		content, fontSize, fontFamily: "Arial", color, fontWeight, textAlign: "center",
		"transform.positionX": 0, "transform.positionY": y, "transform.scaleX": 1, "transform.scaleY": 1, "transform.rotate": 0, opacity: 1,
	};
}

export function mapInstructionToBlueprints({
	edit, planId, allowMainTransformKeyframes = true,
}: {
	edit: EditInstruction; planId: string; allowMainTransformKeyframes?: boolean;
}): MapInstructionResult {
	const provenance = makeProvenance({ planId, instructionId: edit.id });
	const duration = edit.end - edit.start;
	if (duration <= 0) return { blueprints: [], keyframes: [], skipReason: "Zero duration", skipCode: "zero_duration" };
	if ((edit.target as string) === "master" || (edit.target as string) === "main") {
		return { blueprints: [], keyframes: [], skipReason: "Master forbidden", skipCode: "master_track_forbidden" };
	}
	const mkText = (role: string, name: string, params: Record<string, unknown>): TimelineElementBlueprint => ({
		kind: "text",
		stableId: makeStableElementId({ planId, instructionId: edit.id, role }),
		trackHint: "text", start: edit.start, duration, provenance,
		payload: {
			type: "text", name, startTime: edit.start, duration, trimStart: 0, trimEnd: 0,
			params: buildAiElementParams({
				base: params,
				stableId: makeStableElementId({ planId, instructionId: edit.id, role }),
				provenance,
			}),
		},
	});
	switch (edit.type) {
		case "keyword_emphasis": {
			const style = edit.metadata.style;
			const color = style === "color" || style === "highlight" ? "#ffd166" : "#ffffff";
			return { blueprints: [mkText("primary", `Emphasis: ${edit.metadata.keyword}`, { ...baseText(edit.metadata.keyword, color, "bold", 7, 30) })], keyframes: [] };
		}
		case "caption_emphasis":
			return { blueprints: [mkText("primary", `Caption`, { ...baseText(edit.metadata.text, "#ffffff", edit.metadata.style === "bold" ? "bold" : "normal", 6, 38) })], keyframes: [] };
		case "callout": {
			const x = edit.metadata.placement === "left" ? -30 : edit.metadata.placement === "right" ? 30 : 0;
			return { blueprints: [mkText("primary", `Callout`, { ...baseText(edit.metadata.text, "#ffffff", "normal", 5, 0), "transform.positionX": x, "background.enabled": true, "background.color": "#e63946" })], keyframes: [] };
		}
		case "graphic": {
			const stableId = makeStableElementId({ planId, instructionId: edit.id });
			return { blueprints: [{ kind: "graphic", stableId, trackHint: "graphic", start: edit.start, duration, provenance, payload: {
				type: "graphic", name: edit.metadata.label ?? edit.metadata.graphicKind, definitionId: "rectangle",
				startTime: edit.start, duration, trimStart: 0, trimEnd: 0,
				params: buildAiElementParams({
				base: { "transform.scaleX": 0.35, "transform.scaleY": 0.35, opacity: 0.85, fill: "#4cc9f0" },
				stableId,
				provenance,
			}),
			}}], keyframes: [] };
		}
		case "diagram": {
			const labels = (edit.metadata.elements?.length ?? 0) > 0 ? edit.metadata.elements : [edit.metadata.topic];
			const bps = [mkText("title", edit.metadata.topic, { ...baseText(edit.metadata.topic, "#ffffff", "bold", 8, -35) })];
			labels.forEach((lab, i) => bps.push(mkText(`node-${i}`, lab, { ...baseText(lab, "#f0f0f0", "normal", 6, 5) })));
			return { blueprints: bps, keyframes: [] };
		}
		case "lower_third":
			return { blueprints: [mkText("title", edit.metadata.title, { ...baseText(edit.metadata.title, "#ffffff", "bold", 7, 32) })], keyframes: [] };
		case "zoom_in":
		case "zoom_out":
		case "punch_in":
		case "punch_out": {
			if (!allowMainTransformKeyframes) return { blueprints: [], keyframes: [], skipReason: "Disabled", skipCode: "unsupported_type" };
			const fromScale = edit.metadata.fromScale ?? 1;
			const toScale = edit.metadata.toScale;
			const easing = edit.metadata.easing ?? "ease_in_out";
			const kfs: KeyframeBlueprint[] = (["scaleX", "scaleY"] as const).flatMap((axis) => [
				{ stableId: makeStableElementId({ planId, instructionId: edit.id, role: `kf-start-${axis}` }), propertyPath: `transform.${axis}`, localTime: edit.start, value: fromScale, interpolation: easing, provenance, target: "main_video_transform" as const },
				{ stableId: makeStableElementId({ planId, instructionId: edit.id, role: `kf-end-${axis}` }), propertyPath: `transform.${axis}`, localTime: edit.end, value: toScale, interpolation: easing, provenance, target: "main_video_transform" as const },
			]);
			return { blueprints: [], keyframes: kfs };
		}
		case "transition":
			return { blueprints: [], keyframes: [], skipReason: "Renderer transition support unavailable", skipCode: "renderer_unavailable" };
		case "broll":
		case "ai_broll":
		case "screen_insert":
		case "sfx":
		case "music":
			return { blueprints: [], keyframes: [], skipReason: `Deferred: ${edit.type}`, skipCode: "unsupported_type" };
		default:
			return { blueprints: [], keyframes: [], skipReason: "Unknown", skipCode: "unsupported_type" };
	}
}
