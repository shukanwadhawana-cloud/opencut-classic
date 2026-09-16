"use client";

import { useEffect } from "react";

/**
 * Registers the OpenCut app-shell service worker once on the client.
 * Does not cache user media; see public/sw.js.
 */
export function RegisterServiceWorker() {
	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!("serviceWorker" in navigator)) return;
		const register = async () => {
			try {
				const reg = await navigator.serviceWorker.register("/sw.js", {
					scope: "/",
					updateViaCache: "none",
				});
				reg.update().catch(() => {});
			} catch (err) {
				console.warn("[pwa] service worker registration failed:", err);
			}
		};
		void register();
	}, []);

	return null;
}
