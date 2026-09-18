import type { SceneTracks, TimelineElement, TimelineTrack, VideoTrack, TextTrack, GraphicElement, TextElement, VideoElement } from "@/timeline/types";
import type { MediaTime } from "@/wasm";
import type { ExecutionResult, KeyframeBlueprint, TimelineElementBlueprint } from "./types";
import { AI_STABLE_ID_PARAM, buildAiElementParams } from "./types";
import type { AnimationPath, ElementAnimations } from "@/animation/types";

export interface ApplicationSkip {
	stableId: string; reason: string;
	code: "duplicate" | "master_track_forbidden" | "invalid_timing" | "no_main_video" | "unsupported_payload";
}
export interface ApplicationResult {
	ok: boolean; tracks: SceneTracks; insertedElementIds: string[]; appliedKeyframeIds: string[];
	skipped: ApplicationSkip[]; warnings: string[];
}

export function collectExistingStableIds({ tracks }: { tracks: SceneTracks }): Set<string> {
	const ids = new Set<string>();
	const all: TimelineElement[] = [];
	all.push(...tracks.main.elements);
	for (const track of tracks.overlay) all.push(...track.elements);
	for (const track of tracks.audio) all.push(...track.elements);
	for (const el of all) {
		const stable = el.params?.[AI_STABLE_ID_PARAM];
		if (typeof stable === "string" && stable.length > 0) ids.add(stable);
	}
	return ids;
}

function asMediaTime(ticks: number): MediaTime { return ticks as MediaTime; }

function blueprintToElement({ blueprint }: { blueprint: TimelineElementBlueprint }): TimelineElement | null {
	const payload = blueprint.payload;
	const type = payload.type;
	const name = String(payload.name ?? "AI element");
	const startTime = asMediaTime(Number(payload.startTime ?? blueprint.start));
	const duration = asMediaTime(Number(payload.duration ?? blueprint.duration));
	const params = buildAiElementParams({ base: (payload.params as Record<string, unknown> | undefined) ?? null, stableId: blueprint.stableId, provenance: blueprint.provenance });
	if ((duration as number) <= 0) return null;
	if (type === "text") return { id: blueprint.stableId, type: "text", name, startTime, duration, trimStart: asMediaTime(0), trimEnd: asMediaTime(0), params } as TextElement;
	if (type === "graphic") return { id: blueprint.stableId, type: "graphic", name, definitionId: String(payload.definitionId ?? "rectangle"), startTime, duration, trimStart: asMediaTime(0), trimEnd: asMediaTime(0), params } as GraphicElement;
	return null;
}

export function applyExecutionResult({ result, tracks }: { result: ExecutionResult; tracks: SceneTracks }): ApplicationResult {
	const skipped: ApplicationSkip[] = [];
	const warnings = [...result.warnings];
	const insertedElementIds: string[] = [];
	const appliedKeyframeIds: string[] = [];
	let next = tracks;
	const existing = collectExistingStableIds({ tracks: next });

	for (const bp of result.blueprints) {
		if (bp.payload.type === "video") { skipped.push({ stableId: bp.stableId, reason: "Master protected", code: "master_track_forbidden" }); continue; }
		if (existing.has(bp.stableId)) { skipped.push({ stableId: bp.stableId, reason: "Duplicate", code: "duplicate" }); continue; }
		const element = blueprintToElement({ blueprint: bp });
		if (!element) { skipped.push({ stableId: bp.stableId, reason: "Unsupported", code: "unsupported_payload" }); continue; }
		const trackType = bp.payload.type === "graphic" ? "graphic" : "text";
		let track = next.overlay.find((t) => t.type === trackType);
		if (!track) {
			const trackId = `ai-track-${trackType}`;
			const newTrack = trackType === "text"
				? { id: trackId, name: "AI Text", type: "text" as const, elements: [], hidden: false }
				: { id: trackId, name: "AI Graphics", type: "graphic" as const, elements: [], hidden: false };
			next = { ...next, overlay: [...next.overlay, newTrack] };
			track = newTrack as typeof track;
		}
		const tid = track!.id;
		next = {
			...next,
			overlay: next.overlay.map((t) => t.id === tid ? { ...t, elements: [...t.elements, element] } as TimelineTrack : t) as typeof next.overlay,
		};
		insertedElementIds.push(element.id);
		existing.add(bp.stableId);
	}

	for (const kf of result.keyframes) {
		if (existing.has(kf.stableId)) { skipped.push({ stableId: kf.stableId, reason: "Duplicate", code: "duplicate" }); continue; }
		const video = next.main.elements.find((e): e is VideoElement => e.type === "video");
		if (!video) { skipped.push({ stableId: kf.stableId, reason: "No main video", code: "no_main_video" }); continue; }
		if (!kf.propertyPath.startsWith("transform.")) { skipped.push({ stableId: kf.stableId, reason: "Non-transform", code: "master_track_forbidden" }); continue; }
		const masterStart = video.startTime;
		const masterDuration = video.duration;
		const masterMediaId = video.mediaId;
		const localTime = Math.max(0, Math.min(kf.localTime - (masterStart as number), masterDuration as number)) as MediaTime;
		const path = kf.propertyPath as AnimationPath;
		const existingAnims = (video.animations ?? {}) as ElementAnimations;
		const channel = existingAnims[path] as { keyframes?: Array<{ id: string; time: MediaTime; value: number }> } | undefined;
		const keyframes = [...(channel?.keyframes ?? [])];
		const entry = { id: kf.stableId, time: localTime, value: kf.value };
		const idx = keyframes.findIndex((k) => k.id === kf.stableId);
		if (idx >= 0) keyframes[idx] = entry; else keyframes.push(entry);
		const updated: VideoElement = {
			...video, startTime: masterStart, duration: masterDuration, mediaId: masterMediaId,
			animations: { ...existingAnims, [path]: { ...(channel ?? {}), keyframes } } as ElementAnimations,
		};
		next = { ...next, main: { ...next.main, elements: next.main.elements.map((e) => e.id === video.id ? updated : e) as VideoTrack["elements"] } };
		appliedKeyframeIds.push(kf.stableId);
		existing.add(kf.stableId);
	}

	return { ok: true, tracks: next, insertedElementIds, appliedKeyframeIds, skipped, warnings };
}

export function snapshotTracks({ tracks }: { tracks: SceneTracks }): string {
	return JSON.stringify(tracks);
}
