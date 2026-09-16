# Required patches still apply from local tree

## 1. project.transcripts persistence

In `apps/web/src/services/storage/service.ts`:

**saveProject** — after `timelineViewState`:

```ts
...(project.transcripts ? { transcripts: project.transcripts } : {}),
```

**loadProject** — after `timelineViewState`:

```ts
...((serializedProject as { transcripts?: TProject["transcripts"] }).transcripts
  ? { transcripts: (serializedProject as { transcripts: TProject["transcripts"] }).transcripts }
  : {}),
```

Local file with patches: use branch commit after full push, or `/tmp/opencut-reconcile` snapshot.

## 2. Captions AI Edit button

`apps/web/src/subtitles/components/assets-view.tsx` must import:

```ts
import {
  runAiEditInEditor,
  getTranscriptFromProject,
  storeTranscriptOnProject,
  transcriptionResultToDirectorTranscript,
} from "@/ai/edit-orchestrator/run-ai-edit-live";
import { toast } from "sonner";
```

After ASR success, call `storeTranscriptOnProject`.

Add **AI Edit** button calling `runAiEditInEditor`.

Full patched file is in the local reconciliation tree (11KB).
