"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

function safeParse(s: string): object | string {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export function DescriptionEditor({
  initial,
  onSave,
}: {
  initial: string | null;
  onSave: (json: string | null) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initial ? safeParse(initial) : "",
    immediatelyRender: false, // required for Next.js SSR (no hydration mismatch)
    editorProps: {
      attributes: { class: "tiptap min-h-[120px] text-sm" },
    },
    onBlur: ({ editor }) => {
      onSave(editor.isEmpty ? null : JSON.stringify(editor.getJSON()));
    },
  });

  return (
    <div className="rounded-md border border-black/15 dark:border-white/20">
      {editor && <Toolbar editor={editor} />}
      <div className="px-3 py-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    `rounded px-2 py-0.5 text-xs ${
      active ? "bg-foreground text-background" : "text-foreground/70 hover:bg-black/[.06] dark:hover:bg-white/[.08]"
    }`;

  return (
    <div className="flex flex-wrap gap-1 border-b border-black/10 dark:border-white/15 px-2 py-1.5">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>
        B
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}>
        <span className="italic">I</span>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
      >
        H
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>
        • List
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>
        1. List
      </button>
    </div>
  );
}
