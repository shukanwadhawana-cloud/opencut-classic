import type { EditorCore } from "@/core";
import { processMediaAssets } from "@/media/processing";
import type { MediaAsset } from "@/media/types";
import { DEFAULT_NEW_ELEMENT_DURATION } from "@/timeline/creation";
import { buildElementFromMedia } from "@/timeline/element-utils";
import { mediaTimeFromSeconds } from "@/wasm";

/**
 * Process files, save as media assets, and auto-place the first video/image
 * onto an empty main track for a smoother first-import experience.
 */
export async function importMediaFilesToProject({
	editor,
	projectId,
	files,
	onProgress,
}: {
	editor: EditorCore;
	projectId: string;
	files: File[];
	onProgress?: (progress: { progress: number }) => void;
}): Promise<{ uploadedCount: number; assetNames: string[] }> {
	const processedAssets = await processMediaAssets({ files, onProgress });
	if (processedAssets.length === 0) {
		throw new Error(
			"No media could be processed. Use H.264 MP4/WebM, or check browser storage space.",
		);
	}

	const created: MediaAsset[] = [];
	for (const asset of processedAssets) {
		const saved = await editor.media.addMediaAsset({ projectId, asset });
		if (saved) created.push(saved);
	}
	if (created.length === 0) {
		throw new Error(
			"Media processed but could not be saved (browser storage full?).",
		);
	}

	const mainEmpty =
		editor.scenes.getActiveScene().tracks.main.elements.length === 0;
	const primary =
		created.find((a) => a.type === "video") ??
		created.find((a) => a.type === "image");
	if (mainEmpty && primary) {
		const duration =
			primary.duration != null
				? mediaTimeFromSeconds({ seconds: primary.duration })
				: DEFAULT_NEW_ELEMENT_DURATION;
		const element = buildElementFromMedia({
			mediaId: primary.id,
			mediaType: primary.type,
			name: primary.name,
			duration,
			startTime: mediaTimeFromSeconds({ seconds: 0 }),
		});
		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});
	}

	return {
		uploadedCount: created.length,
		assetNames: created.map((asset) => asset.name),
	};
}
