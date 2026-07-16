import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";

import { MentionList, type MentionListRef, type MentionMember } from "./mention-list";

type SuggestionConfig = Omit<SuggestionOptions, "editor">;

function mentionSuggestion(members: MentionMember[]): SuggestionConfig {
  return {
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      return members
        .filter((m) => (m.name ?? m.email).toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
        .slice(0, 8);
    },
    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null;
      let popup: HTMLDivElement | null = null;

      const place = (rect: DOMRect | null | undefined) => {
        if (!popup || !rect) return;
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 4}px`;
      };

      return {
        onStart: (props: SuggestionProps) => {
          const renderer = new ReactRenderer(MentionList, { props, editor: props.editor });
          const el = document.createElement("div");
          el.style.position = "fixed";
          el.style.zIndex = "60";
          el.appendChild(renderer.element);
          document.body.appendChild(el);
          component = renderer;
          popup = el;
          place(props.clientRect?.());
        },
        onUpdate: (props: SuggestionProps) => {
          component?.updateProps(props);
          place(props.clientRect?.());
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === "Escape") return true;
          return component?.ref?.onKeyDown(props.event) ?? false;
        },
        onExit: () => {
          popup?.remove();
          component?.destroy();
          popup = null;
          component = null;
        },
      };
    },
  };
}

/** Mention extension bound to a card's mentionable members (edit mode). */
export function createMention(members: MentionMember[]) {
  return Mention.configure({
    HTMLAttributes: { class: "mention" },
    suggestion: mentionSuggestion(members),
  });
}

/** Render-only mention (no picker) — for turning stored docs into HTML. */
export const mentionRenderExtension = Mention.configure({ HTMLAttributes: { class: "mention" } });
