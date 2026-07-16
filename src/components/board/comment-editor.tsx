"use client";

import { useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

import { createMention, mentionRenderExtension } from "./mention";
import type { MentionMember } from "./mention-list";
import { Button } from "@/components/ui/button";

const RENDER_EXTENSIONS = [StarterKit, mentionRenderExtension];

/** A TipTap comment box with @-mentions. Emits the doc as a JSON string on send. */
export function CommentComposer({
  mentionMembers,
  onSubmit,
  buttonLabel = "Comment",
}: {
  mentionMembers?: MentionMember[];
  onSubmit: (json: string) => void;
  buttonLabel?: string;
}) {
  const extensions = useMemo(
    () => (mentionMembers ? [StarterKit, createMention(mentionMembers)] : [StarterKit]),
    [mentionMembers],
  );
  const editor = useEditor({
    extensions,
    content: "",
    immediatelyRender: false,
    editorProps: { attributes: { class: "tiptap min-h-[52px] text-sm" } },
  });

  function submit() {
    if (!editor || editor.isEmpty) return;
    onSubmit(JSON.stringify(editor.getJSON()));
    editor.commands.clearContent();
  }

  return (
    <div className="rounded-md border border-border-strong">
      <div
        className="px-3 py-2"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
        <span className="text-[11px] text-muted-foreground">@ to mention · ⌘↵ to send</span>
        <Button size="xs" onClick={submit}>{buttonLabel}</Button>
      </div>
    </div>
  );
}

/** Render a stored comment: TipTap JSON → HTML, with a plain-text fallback for
 *  legacy comments saved before the rich-text upgrade. */
export function CommentBody({ body }: { body: string }) {
  const html = useMemo(() => {
    try {
      const doc = JSON.parse(body);
      if (doc && typeof doc === "object" && doc.type === "doc") return generateHTML(doc, RENDER_EXTENSIONS);
    } catch {
      /* legacy plain text */
    }
    return null;
  }, [body]);

  if (html === null) return <p className="whitespace-pre-wrap text-sm">{body}</p>;
  return <div className="tiptap text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}
