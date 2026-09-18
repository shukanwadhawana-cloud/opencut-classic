"use client";

import { useState } from "react";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/editor/use-editor";
import { runAutoEdit } from "@/ai/auto-edit";

export function AutoEditButton() {
  const editor = useEditor();
  const [running, setRunning] = useState(false);

  const handleClick = async () => {
    if (running) return;
    setRunning(true);
    const toastId = toast.loading("Preparing AI edit...");
    try {
      const result = await runAutoEdit({
        editor,
        onProgress: (message) => toast.loading(message, { id: toastId }),
      });
      toast.success(
        `Auto edit complete: ${result.captionsAdded} captions, ${result.brollAdded} B-roll inserts, and ${result.zoomsAndCalloutsApplied} AI edits.`,
        { id: toastId },
      );
    } catch (error) {
      console.error("Auto edit failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Auto edit failed",
        { id: toastId },
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={running}
      className="gap-1.5"
      title="Transcribe, caption, add zooms/callouts, and match B-roll automatically"
    >
      <HugeiconsIcon icon={SparklesIcon} />
      {running ? "AI Editing…" : "Auto Edit"}
    </Button>
  );
}
