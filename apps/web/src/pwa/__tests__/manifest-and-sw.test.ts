import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const publicDir = join(import.meta.dir, "../../../public");
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngDimensions(buf: Buffer): { width: number; height: number } | null {
	if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIG)) return null;
	const width = buf.readUInt32BE(16);
	const height = buf.readUInt32BE(20);
	return { width, height };
}

describe("PWA manifest", () => {
	test("manifest.json exists and is valid JSON", () => {
		const path = join(publicDir, "manifest.json");
		expect(existsSync(path)).toBe(true);
		const manifest = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
		expect(manifest.name).toBeTruthy();
		expect(manifest.short_name).toBeTruthy();
		expect(manifest.start_url).toBe("/");
		expect(manifest.scope).toBe("/");
		expect(manifest.display).toBe("standalone");
		expect(manifest.theme_color).toBeTruthy();
		expect(manifest.background_color).toBeTruthy();
		const icons = manifest.icons as Array<{ src: string; sizes: string; type?: string }>;
		expect(Array.isArray(icons)).toBe(true);
		expect(icons.length).toBeGreaterThanOrEqual(2);
		const sizes = new Set(icons.map((i) => i.sizes));
		expect(sizes.has("192x192")).toBe(true);
		expect(sizes.has("512x512")).toBe(true);
		for (const icon of icons) {
			expect(icon.type === undefined || icon.type === "image/png").toBe(true);
		}
	});

	test("icon files exist with valid PNG signatures and declared dimensions", () => {
		const path = join(publicDir, "manifest.json");
		const manifest = JSON.parse(readFileSync(path, "utf8")) as {
			icons: Array<{ src: string; sizes: string }>;
		};
		const seen = new Set<string>();
		for (const icon of manifest.icons) {
			const file = join(publicDir, icon.src.replace(/^\//, ""));
			expect(existsSync(file)).toBe(true);
			if (seen.has(file)) continue;
			seen.add(file);
			const buf = readFileSync(file);
			expect(buf.subarray(0, 8).equals(PNG_SIG)).toBe(true);
			const dims = pngDimensions(buf);
			expect(dims).not.toBeNull();
			const [w, h] = icon.sizes.split("x").map(Number);
			expect(dims!.width).toBe(w);
			expect(dims!.height).toBe(h);
		}
	});
});

describe("PWA service worker", () => {
	test("sw.js exists and declares cache version without media caching", () => {
		const path = join(publicDir, "sw.js");
		expect(existsSync(path)).toBe(true);
		const src = readFileSync(path, "utf8");
		expect(src).toContain("CACHE_VERSION");
		expect(src).toContain("opencut-shell-");
		expect(src).toContain("isMediaOrWasm");
		expect(src).toMatch(/mp4|webm|wasm/);
		expect(src.toLowerCase()).not.toMatch(/api[_-]?key|secret|password|token\s*=/);
	});

	test("offline fallback page exists", () => {
		expect(existsSync(join(publicDir, "offline.html"))).toBe(true);
	});
});
