import { describe, expect, test } from "bun:test";
import type { ImportMediaResult } from "@/media/import-and-place";

describe("ImportMediaResult contract", () => {
	test("result shape includes failedNames and placement flag", () => {
		const sample: ImportMediaResult = {
			uploadedCount: 1,
			assetNames: ["clip.mp4"],
			failedNames: [],
			placedOnTimeline: true,
		};
		expect(sample.uploadedCount).toBe(1);
		expect(sample.failedNames).toEqual([]);
		expect(sample.placedOnTimeline).toBe(true);
	});
});
