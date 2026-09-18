"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useEditor } from "@/editor/use-editor";
import { showMediaUploadToast } from "@/media/upload-toast";
import { importMediaFilesToProject } from "@/media/import-and-place";

export function useMediaImport() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);

	const processFiles = async ({ files }: { files: File[] }) => {
		if (!files || files.length === 0) return;
		if (!activeProject) {
			toast.error("No active project");
			return;
		}

		setIsProcessing(true);
		setProgress(0);
		try {
			await showMediaUploadToast({
				filesCount: files.length,
				promise: async () =>
					importMediaFilesToProject({
						editor,
						projectId: activeProject.metadata.id,
						files,
						onProgress: (p) => setProgress(p.progress),
					}),
			});
		} catch (error) {
			console.error("Error processing files:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to import media",
			);
		} finally {
			setIsProcessing(false);
			setProgress(0);
		}
	};

	return { isProcessing, progress, processFiles };
}
