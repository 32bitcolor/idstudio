"use client";

import { useState, useTransition } from "react";
import {
  createQuestion,
  setQuestionType,
  updateQuestionPrompt,
  updateQuestionPoints,
  updateQuestionExplanation,
  moveQuestion,
  deleteQuestion,
  createOption,
  updateOptionText,
  setOptionCorrect,
  moveOption,
  deleteOption,
} from "@/app/actions/exams";
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABEL,
  isOptionBased,
  isSingleCorrect,
  type QuestionType,
} from "@/lib/exam";
import { DescriptionEditor } from "@/components/board/description-editor";

export type OptionInit = { id: string; text: string; isCorrect: boolean; position: string };
export type QuestionInit = {
  id: string;
  type: string;
  prompt: string | null;
  points: number;
  explanation: string | null;
  position: string;
  options: OptionInit[];
};

function move<T>(arr: T[], from: number, to: number) {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function QuestionsSection({ examId, initial }: { examId: string; initial: QuestionInit[] }) {
  const [questions, setQuestions] = useState<QuestionInit[]>(initial);
  const [, startTransition] = useTransition();

  function reorder(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const id = questions[index].id;
    setQuestions(move(questions, index, newIndex));
    startTransition(() => void moveQuestion(id, newIndex));
  }

  function remove(id: string) {
    if (!confirm("Delete this question?")) return;
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    startTransition(() => void deleteQuestion(id));
  }

  async function add() {
    const res = await createQuestion(examId);
    if ("question" in res && res.question) setQuestions((prev) => [...prev, res.question]);
  }

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">Questions</h2>
        {questions.length > 0 && (
          <span className="text-xs text-foreground/40">
            {questions.length} · {totalPoints} {totalPoints === 1 ? "point" : "points"}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {questions.length === 0 && (
          <p className="text-sm text-foreground/40">No questions yet. Add the first one below.</p>
        )}
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={i}
            total={questions.length}
            onReorder={reorder}
            onRemove={remove}
          />
        ))}
      </div>

      <button
        onClick={add}
        className="mt-3 rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-hover"
      >
        + Add a question
      </button>
    </section>
  );
}

function QuestionCard({
  question,
  index,
  total,
  onReorder,
  onRemove,
}: {
  question: QuestionInit;
  index: number;
  total: number;
  onReorder: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(question.type);
  const [points, setPoints] = useState(question.points);
  const [options, setOptions] = useState<OptionInit[]>(question.options);
  const [, startTransition] = useTransition();

  async function changeType(next: string) {
    setType(next);
    const res = await setQuestionType(question.id, next);
    // The action may seed (true_false) or collapse correct flags — sync from it.
    if (res && "options" in res && res.options) setOptions(res.options);
  }

  function setCorrect(optionId: string, value: boolean) {
    setOptions((prev) =>
      prev.map((o) => {
        if (o.id === optionId) return { ...o, isCorrect: value };
        // Single-correct types: selecting one clears the others locally too.
        if (value && isSingleCorrect(type)) return { ...o, isCorrect: false };
        return o;
      }),
    );
    startTransition(() => void setOptionCorrect(optionId, value));
  }

  function removeOption(optionId: string) {
    setOptions((prev) => prev.filter((o) => o.id !== optionId));
    startTransition(() => void deleteOption(optionId));
  }

  function reorderOption(i: number, dir: -1 | 1) {
    const newIndex = i + dir;
    if (newIndex < 0 || newIndex >= options.length) return;
    const id = options[i].id;
    setOptions(move(options, i, newIndex));
    startTransition(() => void moveOption(id, newIndex));
  }

  async function addOption(text: string) {
    const res = await createOption(question.id, text);
    if ("option" in res && res.option) setOptions((prev) => [...prev, res.option]);
  }

  const promptText = previewText(question.prompt);

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded px-1 text-foreground/40 hover:bg-hover"
          title={open ? "Collapse" : "Expand"}
        >
          {open ? "▾" : "▸"}
        </button>
        <span className="shrink-0 text-xs tabular-nums text-foreground/40">{index + 1}</span>
        {!open && (
          <span className="min-w-0 flex-1 truncate text-sm text-foreground/70">
            {promptText || <span className="text-foreground/30">Untitled question</span>}
          </span>
        )}
        {open && <span className="min-w-0 flex-1" />}
        <select
          value={type}
          onChange={(e) => void changeType(e.target.value)}
          className="shrink-0 rounded-md border border-border-strong bg-transparent px-2 py-1 text-xs outline-none"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABEL[t as QuestionType]}
            </option>
          ))}
        </select>
        <label className="flex shrink-0 items-center gap-1 text-xs text-foreground/50" title="Points">
          <input
            type="number"
            min={0}
            max={1000}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            onBlur={() => {
              if (points !== question.points) startTransition(() => void updateQuestionPoints(question.id, points));
            }}
            className="w-12 rounded border border-border-strong bg-transparent px-1 py-0.5 text-xs outline-none"
          />
          pt
        </label>
        <div className="flex shrink-0 items-center gap-1 text-foreground/50">
          <button disabled={index === 0} onClick={() => onReorder(index, -1)} className="rounded px-1 hover:bg-hover disabled:opacity-25" title="Move up">
            ↑
          </button>
          <button disabled={index === total - 1} onClick={() => onReorder(index, 1)} className="rounded px-1 hover:bg-hover disabled:opacity-25" title="Move down">
            ↓
          </button>
          <button onClick={() => onRemove(question.id)} className="rounded px-1 hover:bg-red-500/10 hover:text-red-600" title="Delete question">
            ×
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-3 py-3">
          <label className="mb-1 block text-xs font-medium text-foreground/60">Question prompt</label>
          <DescriptionEditor
            initial={question.prompt}
            editorClass="min-h-[64px] text-sm"
            onSave={(json) => void updateQuestionPrompt(question.id, json)}
          />

          {isOptionBased(type) && (
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-foreground/60">
                Answer options {isSingleCorrect(type) ? "(one correct)" : "(mark all correct)"}
              </label>
              <div className="flex flex-col gap-2">
                {options.length === 0 && (
                  <p className="text-xs text-foreground/40">No options yet. Add some below.</p>
                )}
                {options.map((o, i) => (
                  <OptionRow
                    key={o.id}
                    option={o}
                    index={i}
                    total={options.length}
                    single={isSingleCorrect(type)}
                    onSetCorrect={setCorrect}
                    onReorder={reorderOption}
                    onRemove={removeOption}
                  />
                ))}
              </div>
              <OptionComposer onAdd={addOption} />
            </div>
          )}

          {type === "short_answer" && (
            <p className="mt-4 text-xs text-foreground/40">
              Short-answer responses are graded manually when reviewing attempts (Phase 4, Slice 2).
            </p>
          )}

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-foreground/60">Explanation (shown after answering)</label>
            <DescriptionEditor
              initial={question.explanation}
              editorClass="min-h-[48px] text-sm"
              onSave={(json) => void updateQuestionExplanation(question.id, json)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function OptionRow({
  option,
  index,
  total,
  single,
  onSetCorrect,
  onReorder,
  onRemove,
}: {
  option: OptionInit;
  index: number;
  total: number;
  single: boolean;
  onSetCorrect: (id: string, value: boolean) => void;
  onReorder: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const [text, setText] = useState(option.text);
  const [, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <input
        type={single ? "radio" : "checkbox"}
        checked={option.isCorrect}
        onChange={(e) => onSetCorrect(option.id, single ? true : e.target.checked)}
        className="h-4 w-4 shrink-0"
        title="Mark as correct"
      />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text.trim() && text !== option.text) startTransition(() => void updateOptionText(option.id, text));
        }}
        className="min-w-0 flex-1 rounded border border-border-strong bg-transparent px-2 py-1 text-sm outline-none focus:border-foreground/60"
        placeholder="Option text…"
      />
      <div className="flex shrink-0 items-center gap-1 text-foreground/50">
        <button disabled={index === 0} onClick={() => onReorder(index, -1)} className="rounded px-1 hover:bg-hover disabled:opacity-25" title="Move up">
          ↑
        </button>
        <button disabled={index === total - 1} onClick={() => onReorder(index, 1)} className="rounded px-1 hover:bg-hover disabled:opacity-25" title="Move down">
          ↓
        </button>
        <button onClick={() => onRemove(option.id)} className="rounded px-1 hover:bg-red-500/10 hover:text-red-600" title="Delete option">
          ×
        </button>
      </div>
    </div>
  );
}

function OptionComposer({ onAdd }: { onAdd: (text: string) => void }) {
  const [value, setValue] = useState("");

  function submit() {
    const v = value.trim();
    if (v) onAdd(v);
    setValue("");
  }

  return (
    <div className="mt-2 flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
        }}
        placeholder="+ Add an option…"
        className="flex-1 rounded border border-border-strong bg-transparent px-2 py-1 text-sm outline-none focus:border-foreground/60"
      />
      <button onClick={submit} className="rounded-md px-2 py-1 text-sm text-foreground/60 hover:bg-hover">
        Add
      </button>
    </div>
  );
}

// Strip a TipTap JSON document down to a short plain-text preview for the collapsed
// question header. Falls back to empty string on anything unparseable.
function previewText(json: string | null): string {
  if (!json) return "";
  try {
    const doc = JSON.parse(json);
    const parts: string[] = [];
    const walk = (node: { text?: string; content?: unknown[] }) => {
      if (typeof node.text === "string") parts.push(node.text);
      if (Array.isArray(node.content)) node.content.forEach((c) => walk(c as { text?: string; content?: unknown[] }));
    };
    walk(doc);
    return parts.join(" ").trim().slice(0, 120);
  } catch {
    return "";
  }
}
