/**
 * Live editor bridge: ExecutionResult → BatchCommand of existing editor commands.
 */
import type { Command } from "@/commands/base-command";
import { BatchCommand } from "@/commands/batch-command";
import { InsertElementCommand } from "@/commands/timeline/element/insert-element";
import { UpsertKeyframeCommand } from "@/commands/timeline/element/keyframes/upsert-keyframe";
import type { CreateTimelineElement, SceneTracks, VideoElement } from "@/timeline/types";
import type { MediaTime } from "@/wasm";
import type { AnimationPath, AnimationInterpolation } from "@/animation/types";
import type { ExecutionResult } from "./types";
import { buildAiElementParams } from "./types";
import { collectExistingStableIds } from "./apply";

function asMediaTime(ticks: number): MediaTime {
	return ticks as MediaTime;
}

function mapInterpolation(value: string | undefined): AnimationInterpolation | undefined {
	if (!value) return undefined;
	if (value === "linear" || value === "hold") return value;
	return "linear";
}

export function buildCommandsFromExecutionResult({
	result,
	tracks,
}: {
	result: ExecutionResult;
	tracks: SceneTracks;
}): { commands: Command[]; skippedStableIds: string[]; warnings: string[] } {
	const commands: Command[] = [];
	const skippedStableIds: string[] = [];
	const warnings: string[] = [...result.warnings];
	const existing = collectExistingStableIds({ tracks });

	for (const bp of result.blueprints) {
		if (existing.has(bp.stableId)) {
			skippedStableIds.push(bp.stableId);
			continue;
		}
		if (bp.payload.type === "video") {
			warnings.push(`Rejected video blueprint ${bp.stableId}`);
			skippedStableIds.push(bp.stableId);
			continue;
		}
		const params = buildAiElementParams({
			base: (bp.payload.params as Record<string, unknown> | undefined) ?? null,
			stableId: bp.stableId,
			provenance: bp.provenance,
		});
		const element: CreateTimelineElement =
			bp.payload.type === "graphic"
				? {
						type: "graphic",
						name: String(bp.payload.name ?? "AI graphic"),
						definitionId: String(bp.payload.definitionId ?? "rectangle"),
						startTime: asMediaTime(bp.start),
						duration: asMediaTime(bp.duration),
						trimStart: asMediaTime(0),
						trimEnd: asMediaTime(0),
						params,
					}
				: {
						type: "text",
						name: String(bp.payload.name ?? "AI text"),
						startTime: asMediaTime(bp.start),
						duration: asMediaTime(bp.duration),
						trimStart: asMediaTime(0),
						trimEnd: asMediaTime(0),
						params,
					};
		commands.push(
			new InsertElementCommand({
				element,
				placement: {
					mode: "auto",
					trackType: bp.payload.type === "graphic" ? "graphic" : "text",
				},
			}),
		);
	}

	const mainVideo = tracks.main.elements.find(
		(e): e is VideoElement => e.type === "video",
	);
	if (!mainVideo && result.keyframes.length > 0) {
		warnings.push("No main video for zoom keyframes");
	}

	for (const kf of result.keyframes) {
		if (existing.has(kf.stableId) || !mainVideo) {
			skippedStableIds.push(kf.stableId);
			continue;
		}
		if (!kf.propertyPath.startsWith("transform.")) {
			warnings.push(`Rejected non-transform keyframe ${kf.stableId}`);
			skippedStableIds.push(kf.stableId);
			continue;
		}
		const localTime = Math.max(
			0,
			Math.min(
				kf.localTime - (mainVideo.startTime as number),
				mainVideo.duration as number,
			),
		) as MediaTime;
		commands.push(
			new UpsertKeyframeCommand({
				trackId: tracks.main.id,
				elementId: mainVideo.id,
				propertyPath: kf.propertyPath as AnimationPath,
				time: localTime,
				value: kf.value,
				interpolation: mapInterpolation(kf.interpolation),
				keyframeId: kf.stableId,
			}),
		);
	}

	return { commands, skippedStableIds, warnings };
}

export function applyExecutionResultWithCommands({
	result,
	tracks,
	execute,
}: {
	result: ExecutionResult;
	tracks: SceneTracks;
	execute: (command: Command) => void;
}): { commands: Command[]; skippedStableIds: string[]; warnings: string[] } {
	const plan = buildCommandsFromExecutionResult({ result, tracks });
	if (plan.commands.length === 0) return plan;
	execute(new BatchCommand(plan.commands));
	return plan;
}
