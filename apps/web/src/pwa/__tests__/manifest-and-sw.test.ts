import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const publicDir = join(import.meta.dir, "../../../public");

describe("PWA manifest", () => {
	test("manifest.json exists and is valid JSON", () => {
		const path = join(publicDir, "manifest.json");
		expect(existsSync(path)).toBe(true);
		const raw = readFileSync(path, "utf8");
		const manifest = JSON.parse(raw) as Record<string, unknown>;
		expect(manifest.name).toBeTruthy();
		expect(manifest.short_name).toBeTruthy();
		expect(manifest.start_url).toBe("/");
		expect(manifest.scope).toBe("/");
		expect(manifest.display).toBe("standalone");
		expect(manifest.theme_color).toBeTruthy();
		expect(manifest.background_color).toBeTruthy();
		const icons = manifest.icons as Array<{ src: string; sizes: string }>;
		expect(Array.isArray(icons)).toBe(true);
		expect(icons.length).toBeGreaterThanOrEqual(2);
		const sizes = new Set(icons.map((i) => i.sizes));
		expect(sizes.has("192x192")).toBe(true);
		expect(sizes.has("512x512")).toBe(true);
	});

	test("icon files referenced by manifest exist", () => {
		const path = join(publicDir, "manifest.json");
		const manifest = JSON.parse(readFileSync(path, "utf8")) as {
			icons: Array<{ src: string }>;
		};
		for (const icon of manifest.icons) {
			const file = join(publicDir, icon.src.replace(/^\//, ""));
			expect(existsSync(file)).toBe(true);
		}
	});
});

describe("PWA service worker", () => {
	test("sw.js exists and declares cache version", () => {
		const path = join(publicDir, "sw.js");
		expect(existsSync(path)).toBe(true);
		const src = readFileSync(path, "utf8");
		expect(src).toContain("CACHE_VERSION");
		expect(src).toContain("opencut-shell-");
		expect(src).toMatch(/mp4|webm|wasm/);
		expect(src).toContain("isMediaOrWasm");
	});

	test("offline fallback page exists", () => {
		expect(existsSync(join(publicDir, "offline.html"))).toBe(true);
	});
});
