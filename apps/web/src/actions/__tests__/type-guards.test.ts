import { describe, expect, test } from "bun:test";
import { isActionWithOptionalArgs } from "@/actions/definitions";
import { isShortcutKey } from "@/actions/keybinding";

describe("isActionWithOptionalArgs", () => {
	test("accepts keybinding-safe actions", () => {
		expect(isActionWithOptionalArgs("toggle-play")).toBe(true);
		expect(isActionWithOptionalArgs("undo")).toBe(true);
		expect(isActionWithOptionalArgs("seek-forward")).toBe(true);
	});

	test("rejects required-arg asset actions", () => {
		expect(isActionWithOptionalArgs("remove-media-asset")).toBe(false);
		expect(isActionWithOptionalArgs("remove-media-assets")).toBe(false);
	});

	test("rejects unknown action ids", () => {
		expect(isActionWithOptionalArgs("not-a-real-action")).toBe(false);
		expect(isActionWithOptionalArgs("")).toBe(false);
	});
});

describe("isShortcutKey", () => {
	test("accepts bare and modifier shortcuts", () => {
		expect(isShortcutKey("k")).toBe(true);
		expect(isShortcutKey("space")).toBe(true);
		expect(isShortcutKey("ctrl+z")).toBe(true);
		expect(isShortcutKey("ctrl+shift+z")).toBe(true);
	});

	test("rejects invalid shortcuts", () => {
		expect(isShortcutKey("ctrl+foo")).toBe(false);
		expect(isShortcutKey("meta+k")).toBe(false);
		expect(isShortcutKey("")).toBe(false);
	});
});
