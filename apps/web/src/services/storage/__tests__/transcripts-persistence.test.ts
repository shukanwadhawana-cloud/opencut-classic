import { describe, expect, test } from "bun:test";
import type { DirectorTranscript } from "@/ai/edit-director";

type SerializedLike = {
	timelineViewState?: unknown;
	transcripts?: DirectorTranscript[];
	scenes?: unknown[];
	settings?: unknown;
};

function saveShape(project: {
	transcripts?: DirectorTranscript[];
	timelineViewState?: unknown;
}): SerializedLike {
	return {
		timelineViewState: project.timelineViewState,
		...(project.transcripts ? { transcripts: project.transcripts } : {}),
	};
}

function loadShape(serialized: SerializedLike): { transcripts?: DirectorTranscript[] } {
	return {
		...(serialized.transcripts ? { transcripts: serialized.transcripts } : {}),
	};
}

describe("transcripts persistence contract", () => {
	test("transcripts included when present with integer MediaTime ticks", () => {
		const t: DirectorTranscript = {
			id: "t1",
			fullText: "hello world",
			segments: [
				{ id: "s1", text: "hello", start: 0, end: 120_000 },
				{ id: "s2", text: "world", start: 120_000, end: 240_000 },
			],
			status: "complete",
		};
		const saved = saveShape({ transcripts: [t] });
		expect(saved.transcripts?.[0].id).toBe("t1");
		expect(saved.transcripts?.[0].segments[0].start).toBe(0);
		expect(Number.isInteger(saved.transcripts?.[0].segments[1].end)).toBe(true);
		const loaded = loadShape(JSON.parse(JSON.stringify(saved)) as SerializedLike);
		expect(loaded.transcripts?.[0].segments[1].end).toBe(240_000);
		expect(loaded.transcripts?.[0].fullText).toBe("hello world");
	});

	test("absent transcripts stay absent (backward compatible)", () => {
		const saved = saveShape({});
		expect(saved.transcripts).toBeUndefined();
		expect(loadShape(saved).transcripts).toBeUndefined();
	});

	test("JSON round-trip preserves segment ticks (no float conversion)", () => {
		const t: DirectorTranscript = {
			id: "t2",
			fullText: "x",
			segments: [{ id: "s1", text: "x", start: 15_000, end: 90_000 }],
			status: "complete",
		};
		const round = JSON.parse(JSON.stringify(saveShape({ transcripts: [t] }))) as SerializedLike;
		expect(round.transcripts?.[0].segments[0].start).toBe(15_000);
		expect(round.transcripts?.[0].segments[0].end).toBe(90_000);
	});
});
