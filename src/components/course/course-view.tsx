"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Pencil,
  Eye,
  X,
  Check,
  Download,
  Folder,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  renameCourse,
  setCourseDescription,
  setCourseStatus,
  deleteCourse,
  createLesson,
  renameLesson,
  moveLesson,
  deleteLesson,
  setLessonSection,
  createSection,
  renameSection,
  moveSection,
  deleteSection,
  createBlock,
  updateBlockContent,
  moveBlock,
  deleteBlock,
} from "@/app/actions/courses";
import {
  BLOCK_TYPES,
  BLOCK_LABEL,
  BLOCK_DESCRIPTION,
  BLOCK_CATEGORY,
  parseBlockContent,
  orderLessonsBySections,
  type BlockType,
} from "@/lib/course";
import { BLOCK_REGISTRY, type ProjectObjective } from "@/components/course/blocks";
import { useSetPageTitle } from "@/components/app-shell/breadcrumbs";
import { PageContainer } from "@/components/shared/page";
import { InlineTitle } from "@/components/shared/inline-title";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type BlockInit = { id: string; blockType: string; content: string; position: string };
export type LessonInit = { id: string; title: string; position: string; sectionId: string | null; blocks: BlockInit[] };
export type SectionInit = { id: string; title: string; position: string };
type CourseMeta = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  deliverable: { id: string; name: string; projectId: string; projectName: string } | null;
};

function move<T>(arr: T[], from: number, to: number) {
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

export function CourseView({
  course,
  initialSections,
  initialLessons,
  projectObjectives,
}: {
  course: CourseMeta;
  initialSections: SectionInit[];
  initialLessons: LessonInit[];
  projectObjectives: ProjectObjective[];
}) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [status, setStatus] = useState(course.status);
  const [sections, setSections] = useState<SectionInit[]>(initialSections);
  const [lessons, setLessons] = useState<LessonInit[]>(initialLessons);
  const [activeId, setActiveId] = useState<string>(initialLessons[0]?.id ?? "");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [, startTransition] = useTransition();
  useSetPageTitle(title);

  // Canonical display/playback order: unsectioned lessons first, then each
  // section (its own order) with its lessons (their own order) — shared with
  // the server (moveLesson) and the export engine so all three agree.
  const orderedLessons = useMemo(() => orderLessonsBySections(lessons, sections), [lessons, sections]);
  const active = orderedLessons.find((l) => l.id === activeId) ?? orderedLessons[0];

  function setLessonBlocks(lessonId: string, blocks: BlockInit[]) {
    setLessons((prev) => prev.map((l) => (l.id === lessonId ? { ...l, blocks } : l)));
  }

  async function addLesson() {
    const res = await createLesson(course.id, `Lesson ${lessons.length + 1}`);
    if ("lesson" in res && res.lesson) {
      setLessons((prev) => [...prev, { ...res.lesson, sectionId: null, blocks: [] }]);
      setActiveId(res.lesson.id);
    }
  }
  function renameLessonLocal(id: string, value: string) {
    setLessons((prev) => prev.map((l) => (l.id === id ? { ...l, title: value } : l)));
  }
  function reorderLesson(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= orderedLessons.length) return;
    const a = orderedLessons[index], b = orderedLessons[to];
    if (a.sectionId !== b.sectionId) return; // don't hop across a section boundary
    // Swap positions optimistically — preserves sort order even before the
    // server's authoritative recompute lands.
    setLessons((prev) =>
      prev.map((l) => {
        if (l.id === a.id) return { ...l, position: b.position };
        if (l.id === b.id) return { ...l, position: a.position };
        return l;
      }),
    );
    startTransition(() => void moveLesson(a.id, to));
  }
  function removeLesson(id: string) {
    if (lessons.length === 1) return;
    setLessons((prev) => prev.filter((l) => l.id !== id));
    if (activeId === id) {
      const idx = orderedLessons.findIndex((l) => l.id === id);
      const fallback = orderedLessons[idx + 1] ?? orderedLessons[idx - 1];
      setActiveId(fallback?.id ?? "");
    }
    startTransition(() => void deleteLesson(id));
  }
  function assignLessonSection(lessonId: string, sectionId: string | null) {
    setLessons((prev) => prev.map((l) => (l.id === lessonId ? { ...l, sectionId } : l)));
    startTransition(() => void setLessonSection(lessonId, sectionId));
  }

  async function addSection() {
    const res = await createSection(course.id, `Section ${sections.length + 1}`);
    if ("section" in res && res.section) setSections((prev) => [...prev, res.section]);
  }
  function renameSectionLocal(id: string, value: string) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, title: value } : s)));
  }
  function commitSectionTitle(id: string, value: string) {
    if (value.trim()) startTransition(() => void renameSection(id, value.trim()));
  }
  function reorderSection(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= sections.length) return;
    setSections((prev) => move(prev, index, to));
    startTransition(() => void moveSection(sections[index].id, to));
  }
  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
    setLessons((prev) => prev.map((l) => (l.sectionId === id ? { ...l, sectionId: null } : l)));
    startTransition(() => void deleteSection(id));
  }

  async function addBlock(type: BlockType) {
    if (!active) return;
    const res = await createBlock(active.id, type);
    if ("block" in res && res.block) {
      setLessonBlocks(active.id, [...active.blocks, res.block]);
    }
  }

  return (
    <PageContainer size="wide">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <InlineTitle
            value={title}
            onChange={setTitle}
            onCommit={() => title.trim() && startTransition(() => void renameCourse(course.id, title.trim()))}
            ariaLabel="Course title"
          />
          {course.deliverable && (
            <Link
              href={`/projects/${course.deliverable.projectId}`}
              className="mt-1 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              {course.deliverable.projectName} → {course.deliverable.name}
            </Link>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              startTransition(() => void setCourseStatus(course.id, e.target.value));
            }}
            className="h-8 w-auto"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </Select>
          <div className="flex rounded-lg border border-border p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode("edit")}
              className={cn(mode === "edit" && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground")}
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode("preview")}
              className={cn(mode === "preview" && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground")}
            >
              <Eye className="size-3.5" /> Preview
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="size-3.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export for your LMS</DropdownMenuLabel>
              {([
                { key: "scorm12", label: "SCORM 1.2" },
                { key: "scorm2004", label: "SCORM 2004" },
                { key: "xapi", label: "xAPI (Tin Can)" },
              ] as const).map((f) => (
                <DropdownMenuItem key={f.key} asChild>
                  <a href={`/api/courses/${course.id}/export?format=${f.key}`} download className="cursor-pointer">
                    {f.label}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {mode === "edit" && (
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={(e) => startTransition(() => void setCourseDescription(course.id, e.target.value))}
          rows={2}
          placeholder="Course description (shown on the overview)…"
          className="mt-3 w-full resize-none"
        />
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[14rem_1fr]">
        {/* Lessons rail */}
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lessons</p>
          <LessonRail
            sections={sections}
            orderedLessons={orderedLessons}
            activeId={active?.id ?? ""}
            mode={mode}
            onSelect={setActiveId}
            onReorderLesson={reorderLesson}
            onAssignSection={assignLessonSection}
            onReorderSection={reorderSection}
            onRenameSection={renameSectionLocal}
            onCommitSectionTitle={commitSectionTitle}
            onDeleteSection={removeSection}
          />
          {mode === "edit" && (
            <div className="mt-1 flex flex-col">
              <button onClick={addLesson} className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-hover">
                <Plus className="mr-1 inline size-3.5" /> Add lesson
              </button>
              <button onClick={addSection} className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-hover">
                <Folder className="mr-1 inline size-3.5" /> Add section
              </button>
            </div>
          )}
        </aside>

        {/* Lesson body */}
        <div className="min-w-0">
          {active ? (
            mode === "edit" ? (
              <LessonEditor
                key={active.id}
                courseId={course.id}
                lesson={active}
                objectives={projectObjectives}
                onRename={(v) => {
                  renameLessonLocal(active.id, v);
                }}
                onCommitTitle={(v) => v.trim() && startTransition(() => void renameLesson(active.id, v.trim()))}
                onDeleteLesson={() => removeLesson(active.id)}
                canDelete={lessons.length > 1}
                onBlocksChange={(blocks) => setLessonBlocks(active.id, blocks)}
                onAddBlock={addBlock}
              />
            ) : (
              <LessonPreview courseId={course.id} courseTitle={title} lesson={active} />
            )
          ) : (
            <p className="text-sm text-muted-foreground">No lessons.</p>
          )}
        </div>
      </div>

      {mode === "edit" && (
        <div className="mt-12 border-t border-border pt-4">
          <ConfirmDelete
            title="Delete course?"
            description="This permanently deletes the course and all its lessons and blocks."
            onConfirm={() => deleteCourse(course.id)}
            trigger={
              <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                Delete course
              </Button>
            }
          />
        </div>
      )}
    </PageContainer>
  );
}

type RailRow =
  | { type: "header"; section: SectionInit; sectionIndex: number }
  | { type: "lesson"; lesson: LessonInit; index: number };

function LessonRail({
  sections,
  orderedLessons,
  activeId,
  mode,
  onSelect,
  onReorderLesson,
  onAssignSection,
  onReorderSection,
  onRenameSection,
  onCommitSectionTitle,
  onDeleteSection,
}: {
  sections: SectionInit[];
  orderedLessons: LessonInit[];
  activeId: string;
  mode: "edit" | "preview";
  onSelect: (id: string) => void;
  onReorderLesson: (index: number, dir: -1 | 1) => void;
  onAssignSection: (lessonId: string, sectionId: string | null) => void;
  onReorderSection: (index: number, dir: -1 | 1) => void;
  onRenameSection: (id: string, value: string) => void;
  onCommitSectionTitle: (id: string, value: string) => void;
  onDeleteSection: (id: string) => void;
}) {
  // Walk sections in display order (not lesson order) so an empty section still
  // gets a header — otherwise a freshly created section is invisible until a
  // lesson is assigned to it.
  const indexById = new Map(orderedLessons.map((l, i) => [l.id, i]));
  const rows: RailRow[] = [];
  orderedLessons
    .filter((l) => !l.sectionId)
    .forEach((lesson) => rows.push({ type: "lesson", lesson, index: indexById.get(lesson.id)! }));
  sections.forEach((section, sectionIndex) => {
    rows.push({ type: "header", section, sectionIndex });
    orderedLessons
      .filter((l) => l.sectionId === section.id)
      .forEach((lesson) => rows.push({ type: "lesson", lesson, index: indexById.get(lesson.id)! }));
  });

  return (
    <ul className="flex flex-col gap-0.5">
      {rows.map((row) =>
        row.type === "header" ? (
          <li key={`section-${row.section.id}`} className="group mt-3 flex items-center gap-1 px-1 first:mt-0">
            <InlineTitle
              value={row.section.title}
              onChange={(v) => onRenameSection(row.section.id, v)}
              onCommit={() => onCommitSectionTitle(row.section.id, row.section.title)}
              ariaLabel="Section title"
              disabled={mode !== "edit"}
              className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            />
            {mode === "edit" && (
              <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
                <Button variant="ghost" size="icon-xs" onClick={() => onReorderSection(row.sectionIndex, -1)} disabled={row.sectionIndex === 0} className="text-muted-foreground" title="Move section up"><ChevronUp className="size-3.5" /></Button>
                <Button variant="ghost" size="icon-xs" onClick={() => onReorderSection(row.sectionIndex, 1)} disabled={row.sectionIndex === sections.length - 1} className="text-muted-foreground" title="Move section down"><ChevronDown className="size-3.5" /></Button>
                <ConfirmDelete
                  title="Delete this section?"
                  description="Its lessons become unsectioned, not deleted."
                  confirmLabel="Delete section"
                  onConfirm={() => onDeleteSection(row.section.id)}
                  trigger={
                    <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive" title="Delete section"><Trash2 className="size-3.5" /></Button>
                  }
                />
              </div>
            )}
          </li>
        ) : (
          <li key={row.lesson.id} className="group flex items-center gap-1">
            <button
              onClick={() => onSelect(row.lesson.id)}
              className={cn(
                "flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm",
                row.lesson.id === activeId ? "bg-accent/12 font-medium text-foreground" : "text-muted-foreground hover:bg-hover"
              )}
            >
              <span className="mr-1 text-xs text-muted-foreground">{row.index + 1}.</span>
              {row.lesson.title}
            </button>
            {mode === "edit" && (
              <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
                {sections.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-xs" className="text-muted-foreground" title="Move to section"><Folder className="size-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={() => onAssignSection(row.lesson.id, null)} className="cursor-pointer gap-1.5">
                        <Check className={cn("size-3.5", !row.lesson.sectionId ? "opacity-100" : "opacity-0")} />No section
                      </DropdownMenuItem>
                      {sections.map((s) => (
                        <DropdownMenuItem key={s.id} onSelect={() => onAssignSection(row.lesson.id, s.id)} className="cursor-pointer gap-1.5">
                          <Check className={cn("size-3.5", row.lesson.sectionId === s.id ? "opacity-100" : "opacity-0")} />{s.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button variant="ghost" size="icon-xs" onClick={() => onReorderLesson(row.index, -1)} disabled={row.index === 0 || orderedLessons[row.index - 1]?.sectionId !== row.lesson.sectionId} className="text-muted-foreground" title="Move up"><ChevronUp className="size-3.5" /></Button>
                <Button variant="ghost" size="icon-xs" onClick={() => onReorderLesson(row.index, 1)} disabled={row.index === orderedLessons.length - 1 || orderedLessons[row.index + 1]?.sectionId !== row.lesson.sectionId} className="text-muted-foreground" title="Move down"><ChevronDown className="size-3.5" /></Button>
              </div>
            )}
          </li>
        ),
      )}
    </ul>
  );
}

const CONTENT_TYPES = BLOCK_TYPES.filter((t) => BLOCK_CATEGORY[t] === "content");
const INTERACTIVE_TYPES = BLOCK_TYPES.filter((t) => BLOCK_CATEGORY[t] === "interactive");

function LessonEditor({
  courseId,
  lesson,
  objectives,
  onRename,
  onCommitTitle,
  onDeleteLesson,
  canDelete,
  onBlocksChange,
  onAddBlock,
}: {
  courseId: string;
  lesson: LessonInit;
  objectives: ProjectObjective[];
  onRename: (v: string) => void;
  onCommitTitle: (v: string) => void;
  onDeleteLesson: () => void;
  canDelete: boolean;
  onBlocksChange: (blocks: BlockInit[]) => void;
  onAddBlock: (type: BlockType) => void;
}) {
  const [, startTransition] = useTransition();
  const [inserterOpen, setInserterOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function reorderBlock(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= lesson.blocks.length) return;
    onBlocksChange(move(lesson.blocks, index, to));
    startTransition(() => void moveBlock(lesson.blocks[index].id, to));
  }
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = lesson.blocks.findIndex((b) => b.id === active.id);
    const newIndex = lesson.blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onBlocksChange(arrayMove(lesson.blocks, oldIndex, newIndex));
    startTransition(() => void moveBlock(lesson.blocks[oldIndex].id, newIndex));
  }
  function removeBlock(id: string) {
    onBlocksChange(lesson.blocks.filter((b) => b.id !== id));
    startTransition(() => void deleteBlock(id));
  }
  // Sync a block's edited content up so Preview (which reads parent state) is live.
  function setBlockContent(id: string, json: string) {
    onBlocksChange(lesson.blocks.map((b) => (b.id === id ? { ...b, content: json } : b)));
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <InlineTitle
          value={lesson.title}
          onChange={onRename}
          onCommit={() => onCommitTitle(lesson.title)}
          ariaLabel="Lesson title"
          className="text-lg font-semibold tracking-normal"
        />
        {canDelete && (
          <ConfirmDelete
            title="Delete this lesson?"
            description="This permanently deletes the lesson and all its blocks."
            confirmLabel="Delete lesson"
            onConfirm={onDeleteLesson}
            trigger={
              <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete lesson">
                <Trash2 className="size-4" />
              </Button>
            }
          />
        )}
      </div>

      {lesson.blocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          This lesson is empty. Add your first block below.
        </p>
      ) : (
        <DndContext id={`blocks-${lesson.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={lesson.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {lesson.blocks.map((b, i) => (
                <BlockRow
                  key={b.id}
                  courseId={courseId}
                  block={b}
                  objectives={objectives}
                  index={i}
                  total={lesson.blocks.length}
                  onReorder={reorderBlock}
                  onRemove={removeBlock}
                  onContent={setBlockContent}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Inserter */}
      <div className="mt-3">
        {inserterOpen ? (
          <div className="rounded-xl border border-border-strong p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add a block</span>
              <Button variant="ghost" size="icon-xs" onClick={() => setInserterOpen(false)} className="text-muted-foreground"><X className="size-4" /></Button>
            </div>
            <BlockPicker label="Content" types={CONTENT_TYPES} onPick={(t) => { onAddBlock(t); setInserterOpen(false); }} />
            <BlockPicker label="Interactive" types={INTERACTIVE_TYPES} onPick={(t) => { onAddBlock(t); setInserterOpen(false); }} className="mt-4" />
          </div>
        ) : (
          <button onClick={() => setInserterOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-border-strong hover:text-foreground">
            <Plus className="size-4" /> Add a block
          </button>
        )}
      </div>
    </div>
  );
}

function BlockPicker({
  label,
  types,
  onPick,
  className,
}: {
  label: string;
  types: readonly BlockType[];
  onPick: (t: BlockType) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {types.map((t) => {
          const Icon = BLOCK_REGISTRY[t].icon;
          return (
            <button
              key={t}
              onClick={() => onPick(t)}
              className="flex items-start gap-2.5 rounded-lg border border-border p-2.5 text-left transition-colors hover:border-border-strong hover:bg-hover"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent/12 text-accent"><Icon className="size-4" /></div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{BLOCK_LABEL[t]}</div>
                <div className="text-xs text-muted-foreground">{BLOCK_DESCRIPTION[t]}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BlockRow({
  courseId,
  block,
  objectives,
  index,
  total,
  onReorder,
  onRemove,
  onContent,
}: {
  courseId: string;
  block: BlockInit;
  objectives: ProjectObjective[];
  index: number;
  total: number;
  onReorder: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onContent: (id: string, json: string) => void;
}) {
  const type = block.blockType as BlockType;
  const reg = BLOCK_REGISTRY[type];
  const [content, setContent] = useState(() => parseBlockContent(type, block.content));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  function save(next: unknown) {
    const json = JSON.stringify(next);
    setContent(next as typeof content);
    onContent(block.id, json); // keep parent (and Preview) in sync live
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(() => void updateBlockContent(block.id, json));
    }, 600);
  }

  const Edit = reg.Edit;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="group relative rounded-xl border border-border bg-surface p-3 pl-9"
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-3 flex cursor-grab flex-col items-center text-foreground/30 hover:text-foreground/60 active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="mr-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{BLOCK_LABEL[type]}</span>
        <Button variant="ghost" size="icon-xs" onClick={() => onReorder(index, -1)} disabled={index === 0} className="text-muted-foreground" title="Move up"><ChevronUp className="size-4" /></Button>
        <Button variant="ghost" size="icon-xs" onClick={() => onReorder(index, 1)} disabled={index === total - 1} className="text-muted-foreground" title="Move down"><ChevronDown className="size-4" /></Button>
        <Button variant="ghost" size="icon-xs" onClick={() => onRemove(block.id)} className="text-muted-foreground hover:text-destructive" title="Delete block"><Trash2 className="size-4" /></Button>
      </div>
      <div className="pt-4">
        <Edit content={content} save={save} courseId={courseId} objectives={objectives} />
      </div>
    </div>
  );
}

function LessonPreview({ courseId, courseTitle, lesson }: { courseId: string; courseTitle: string; lesson: LessonInit }) {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm font-medium text-muted-foreground">{courseTitle}</p>
      <h1 className="mt-1 mb-8 text-3xl font-bold tracking-tight">{lesson.title}</h1>
      <div className="flex flex-col gap-6">
        {lesson.blocks.length === 0 && <p className="text-muted-foreground">This lesson has no content yet.</p>}
        {lesson.blocks.map((b) => {
          const type = b.blockType as BlockType;
          const View = BLOCK_REGISTRY[type].View;
          return <View key={b.id} content={parseBlockContent(type, b.content)} courseId={courseId} />;
        })}
      </div>
    </div>
  );
}
