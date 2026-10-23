"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpCircle } from "lucide-react";
import { approveIntakeRequest } from "@/app/actions/intake";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const METHODOLOGIES = [
  { value: "ADDIE", label: "ADDIE (5 phases)" },
  { value: "SAM", label: "SAM (3 phases)" },
  { value: "CUSTOM", label: "Custom (no phases yet)" },
] as const;

/** Approve a request into a new project: name it and pick its methodology. */
export function ApproveDialog({
  request,
  trigger,
}: {
  request: { id: string; title: string; targetDate: string | null };
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(request.title);
  const [methodology, setMethodology] = useState<"ADDIE" | "SAM" | "CUSTOM">("ADDIE");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await approveIntakeRequest(request.id, { name, methodology });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(`/projects/${res.project.id}`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(request.title);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve and create a project</DialogTitle>
          <DialogDescription>
            The project starts with the request&rsquo;s description, audience and requester
            {request.targetDate ? ", and a milestone on the needed-by date" : ""}. The requester is emailed
            that it&rsquo;s approved.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            approve();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="approve-name" className="text-sm font-medium">Project name</label>
            <Input id="approve-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="approve-methodology" className="text-sm font-medium">Methodology</label>
            <Select
              id="approve-methodology"
              value={methodology}
              onChange={(e) => setMethodology(e.target.value as typeof methodology)}
            >
              {METHODOLOGIES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </div>
          {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              <ArrowUpCircle className="size-4" />
              {pending ? "Creating…" : "Approve & create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
