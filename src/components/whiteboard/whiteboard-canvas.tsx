"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import { CaptureUpdateAction, Excalidraw } from "@excalidraw/excalidraw";
import type { BinaryFileData, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { getWhiteboardSceneSince, saveWhiteboardScene } from "@/app/actions/whiteboards";
import { mergeElements, parseScene, sceneSignature, serializeScene, type SceneElement } from "@/lib/whiteboard-scene";

type OnChange = NonNullable<ComponentProps<typeof Excalidraw>["onChange"]>;

// How often an open whiteboard checks for changes made elsewhere (another tab, or an
// assistant over MCP). Only while the tab is visible.
const POLL_MS = 4000;

// Excalidraw has a light and a dark look; pick whichever suits the app's theme (any of
// the 17) by how dark its background is. Follows theme changes and the OS setting.
function subscribeTheme(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  mq.addEventListener("change", cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", cb);
  };
}
function appTheme(): "light" | "dark" {
  const m = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
  if (!m) return "light";
  const [r, g, b] = m.map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 ? "dark" : "light";
}

// Rebuild Excalidraw initialData from our persisted scene JSON.
function parseInitial(scene: string | null): ComponentProps<typeof Excalidraw>["initialData"] {
  if (!scene) return undefined;
  const d = parseScene(scene);
  return {
    elements: d.elements as never,
    appState: { viewBackgroundColor: d.appState.viewBackgroundColor ?? "#ffffff" },
    files: d.files as never,
    scrollToContent: true,
  };
}

export function WhiteboardCanvas({
  whiteboardId,
  initialScene,
  initialVersion,
}: {
  whiteboardId: string;
  initialScene: string | null;
  initialVersion: number;
}) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const theme = useSyncExternalStore(subscribeTheme, appTheme, () => "light" as const);
  const [initialData] = useState(() => parseInitial(initialScene));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version = useRef(initialVersion);
  // What the server is known to hold; a change that doesn't alter it isn't saved.
  const savedSig = useRef<string | null>(null);
  const busy = useRef(false);
  const saveRef = useRef<() => Promise<void>>(async () => {});

  const currentSig = useCallback((a: ExcalidrawImperativeAPI) => sceneSignature(a.getSceneElementsIncludingDeleted(), a.getAppState().viewBackgroundColor), []);

  // Fold a newer server scene into what's on screen, keeping any unsaved local edits.
  const applyRemote = useCallback(
    (a: ExcalidrawImperativeAPI, raw: string, newVersion: number) => {
      const remote = parseScene(raw);
      const dirty = savedSig.current !== currentSig(a);
      const elements = mergeElements(a.getSceneElementsIncludingDeleted() as unknown as SceneElement[], remote.elements);
      const have = a.getFiles();
      const missing = Object.entries(remote.files).filter(([id]) => !have[id]).map(([, f]) => f as BinaryFileData);
      if (missing.length) a.addFiles(missing);
      a.updateScene({ elements: elements as never, captureUpdate: CaptureUpdateAction.NEVER });
      version.current = newVersion;
      if (!dirty) savedSig.current = currentSig(a);
    },
    [currentSig],
  );

  const save = useCallback(async () => {
    if (!api) return;
    if (busy.current) {
      timer.current = setTimeout(() => void saveRef.current(), 500);
      return;
    }
    busy.current = true;
    try {
      const sig = currentSig(api);
      const scene = serializeScene({
        elements: api.getSceneElementsIncludingDeleted() as unknown as SceneElement[],
        appState: { viewBackgroundColor: api.getAppState().viewBackgroundColor },
        files: api.getFiles() as Record<string, unknown>,
      });
      const res = await saveWhiteboardScene(whiteboardId, scene, version.current);
      if ("error" in res) return;
      savedSig.current = sig;
      if (res.scene) applyRemote(api, res.scene, res.version);
      else version.current = res.version;
    } finally {
      busy.current = false;
    }
  }, [api, whiteboardId, currentSig, applyRemote]);

  // Debounced autosave. Excalidraw's onChange fires rapidly, and for scrolls and
  // selections too; only element or background changes are saved.
  const onChange = useCallback<OnChange>(
    (elements, appState) => {
      const sig = sceneSignature(elements, appState.viewBackgroundColor);
      if (savedSig.current === null) savedSig.current = sig; // the scene as loaded
      if (sig === savedSig.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), 1200);
    },
    [save],
  );

  useEffect(() => {
    if (!api) return;
    const poll = setInterval(async () => {
      if (document.visibilityState !== "visible" || busy.current) return;
      busy.current = true;
      try {
        const res = await getWhiteboardSceneSince(whiteboardId, version.current);
        if (!("error" in res) && res.scene && res.version !== version.current) applyRemote(api, res.scene, res.version);
      } finally {
        busy.current = false;
      }
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [api, whiteboardId, applyRemote]);

  // Save anything pending when leaving the page.
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void saveRef.current();
      }
    },
    [],
  );

  return <Excalidraw excalidrawAPI={setApi} initialData={initialData} onChange={onChange} theme={theme} />;
}
