/* OpenCut PWA service worker — app shell only. Do not cache user media. */
const CACHE_VERSION = "opencut-shell-v1";
const SHELL_URLS = ["/", "/manifest.json", "/offline.html"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
		).then(() => self.clients.claim()),
	);
});

function isMediaOrWasm(url) {
	const path = url.pathname.toLowerCase();
	if (/\.(mp4|webm|mov|mkv|avi|m4v|mp3|wav|aac|ogg|flac|wasm|bin)$/.test(path)) return true;
	if (path.includes("/media-files") || path.includes("opfs")) return true;
	return false;
}

function isStaticAsset(url) {
	const path = url.pathname;
	return (
		path.startsWith("/_next/static/") ||
		path.startsWith("/icons/") ||
		path.startsWith("/fonts/") ||
		path.startsWith("/logos/") ||
		path === "/manifest.json" ||
		path === "/favicon.ico"
	);
}

self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.method !== "GET") return;
	let url;
	try {
		url = new URL(req.url);
	} catch {
		return;
	}
	if (url.origin !== self.location.origin) return;
	if (isMediaOrWasm(url)) return;

	if (req.mode === "navigate") {
		event.respondWith(
			fetch(req)
				.then((res) => {
					const copy = res.clone();
					caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
					return res;
				})
				.catch(() =>
					caches.match(req).then((cached) => cached || caches.match("/offline.html") || caches.match("/")),
				),
		);
		return;
	}

	if (isStaticAsset(url)) {
		event.respondWith(
			caches.match(req).then((cached) => {
				const network = fetch(req)
					.then((res) => {
						if (res.ok) {
							const copy = res.clone();
							caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
						}
						return res;
					})
					.catch(() => cached);
				return cached || network;
			}),
		);
	}
});
