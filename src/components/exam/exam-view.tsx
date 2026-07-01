"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  renameExam,
  setExamStatus,
  updateExamDescription,
  updateExamSettings,
  deleteExam,
} from "@/app/actions/exams";
import { EXAM_STATUSES, EXAM_STATUS_LABEL, type ExamStatus } from "@/lib/exam";
import { useSetPageTitle } from "@/components/app-shell/breadcrumbs";
import { QuestionsSection, type QuestionInit } from "@/components/exam/questions-section";

type ExamMeta = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  passingScore: number;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  shuffleQuestions: boolean;
  deliverable: { id: string; name: string; projectId: string; projectName: string } | null;
};

export function ExamView({ exam, initialQuestions }: { exam: ExamMeta; initialQuestions: QuestionInit[] }) {
  const [title, setTitle] = useState(exam.title);
  const [description, setDescription] = useState(exam.description ?? "");
  const [status, setStatus] = useState(exam.status);
  const [, startTransition] = useTransition();
  useSetPageTitle(title);

  // Settings cluster — every change persists the whole group via updateExamSettings.
  const [passingScore, setPassingScore] = useState(exam.passingScore);
  const [timeLimit, setTimeLimit] = useState<number | null>(exam.timeLimitMinutes);
  const [maxAttempts, setMaxAttempts] = useState<number | null>(exam.maxAttempts);
  const [shuffle, setShuffle] = useState(exam.shuffleQuestions);

  function saveSettings(next: Partial<{ passingScore: number; timeLimit: number | null; maxAttempts: number | null; shuffle: boolean }>) {
    const merged = {
      passingScore: next.passingScore ?? passingScore,
      timeLimitMinutes: next.timeLimit !== undefined ? next.timeLimit : timeLimit,
      maxAttempts: next.maxAttempts !== undefined ? next.maxAttempts : maxAttempts,
      shuffleQuestions: next.shuffle ?? shuffle,
    };
    startTransition(() => void updateExamSettings(exam.id, merged));
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== exam.title) startTransition(() => void renameExam(exam.id, title));
            }}
            className="w-full rounded bg-transparent text-2xl font-semibold tracking-tight outline-none hover:bg-hover focus:bg-hover"
          />
          {exam.deliverable && (
            <p className="mt-1 text-sm text-foreground/50">
              Linked to{" "}
              <Link href={`/projects/${exam.deliverable.projectId}`} className="hover:underline">
                {exam.deliverable.name}
              </Link>{" "}
              · {exam.deliverable.projectName}
            </p>
          )}
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-foreground/60">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              startTransition(() => void setExamStatus(exam.id, e.target.value));
            }}
            className="rounded-md border border-border-strong bg-transparent px-2 py-1 text-sm outline-none"
          >
            {EXAM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EXAM_STATUS_LABEL[s as ExamStatus]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-foreground/60">Pass ≥</span>
          <input
            type="number"
            min={0}
            max={100}
            value={passingScore}
            onChange={(e) => setPassingScore(Number(e.target.value))}
            onBlur={() => saveSettings({ passingScore })}
            className="w-16 rounded-md border border-border-strong bg-transparent px-2 py-1 text-sm outline-none"
          />
          <span className="text-foreground/60">%</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-foreground/60">Time limit</span>
          <input
            type="number"
            min={1}
            max={1440}
            placeholder="none"
            value={timeLimit ?? ""}
            onChange={(e) => setTimeLimit(e.target.value === "" ? null : Number(e.target.value))}
            onBlur={() => saveSettings({ timeLimit })}
            className="w-20 rounded-md border border-border-strong bg-transparent px-2 py-1 text-sm outline-none"
          />
          <span className="text-foreground/60">min</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-foreground/60">Max attempts</span>
          <input
            type="number"
            min={1}
            max={100}
            placeholder="∞"
            value={maxAttempts ?? ""}
            onChange={(e) => setMaxAttempts(e.target.value === "" ? null : Number(e.target.value))}
            onBlur={() => saveSettings({ maxAttempts })}
            className="w-16 rounded-md border border-border-strong bg-transparent px-2 py-1 text-sm outline-none"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={shuffle}
            onChange={(e) => {
              setShuffle(e.target.checked);
              saveSettings({ shuffle: e.target.checked });
            }}
            className="h-4 w-4"
          />
          <span className="text-foreground/60">Shuffle questions</span>
        </label>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => updateExamDescription(exam.id, description)}
        placeholder="Add an exam description / instructions…"
        rows={2}
        className="mt-4 w-full resize-none rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60"
      />

      <QuestionsSection examId={exam.id} initial={initialQuestions} />

      <div className="mt-10 border-t border-border pt-4">
        <form
          action={async () => {
            if (confirm("Delete this entire exam?")) await deleteExam(exam.id);
          }}
        >
          <button className="text-sm text-red-600 hover:underline">Delete exam</button>
        </form>
      </div>
    </div>
  );
}
