"use client";

import { useCallback, useRef, type ComponentProps } from "react";
import { Excalidraw, serializeAsJSON } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { updateWhiteboardScene } from "@/app/actions/whiteboards";

type OnChange = NonNullable<ComponentProps<typeof Excalidraw>["onChange"]>;

// Rebuild Excalidraw initialData from our persisted scene JSON (produced by
// serializeAsJSON). Tolerant of empty / unparseable scenes.
function parseInitial(scene: string | null): ComponentProps<typeof Excalidraw>["initialData"] {
  if (!scene) return undefined;
  try {
    const d = JSON.parse(scene);
    return {
      elements: d.elements ?? [],
      appState: { viewBackgroundColor: d.appState?.viewBackgroundColor ?? "#ffffff" },
      files: d.files ?? undefined,
      scrollToContent: true,
    };
  } catch {
    return undefined;
  }
}

export function WhiteboardCanvas({
  whiteboardId,
  initialScene,
}: {
  whiteboardId: string;
  initialScene: string | null;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave (last-write-wins). Excalidraw's onChange fires rapidly.
  const onChange = useCallback<OnChange>(
    (elements, appState, files) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void updateWhiteboardScene(whiteboardId, serializeAsJSON(elements, appState, files, "local"));
      }, 1200);
    },
    [whiteboardId],
  );

  return <Excalidraw initialData={parseInitial(initialScene)} onChange={onChange} />;
}
