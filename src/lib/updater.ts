import "server-only";
import { promises as fs } from "fs";
import path from "path";

// The app's view of the self-update control directory shared with the host agent
// (deploy/update-agent.sh). The agent writes plain-text status fields here; the app
// reads them and drops a one-word `request` file to ask for an action. If the dir
// isn't configured/mounted (e.g. local dev, or an install without the agent), the
// feature reports itself as unavailable rather than erroring.

const DIR = process.env.UPDATE_CONTROL_DIR || "";

export type PendingCommit = {
  commit: string;
  subject: string;
  date: string;
  author: string;
};

export type UpdateStatus = {
  configured: boolean;
  currentCommit: string;
  currentMessage: string;
  currentDate: string;
  behind: number;
  latestCommit: string;
  latestMessage: string;
  state: string; // idle | checking | updating | error
  lastResult: string;
  lastChecked: string;
  previousCommit: string;
  pending: PendingCommit[];
};

async function readPending(): Promise<PendingCommit[]> {
  try {
    const raw = (await fs.readFile(path.join(DIR, "pending"), "utf8")).trim();
    if (!raw) return [];
    return raw.split("\n").map((line) => {
      const [commit, subject, date, author] = line.split(String.fromCharCode(31));
      return { commit: commit ?? "", subject: subject ?? "", date: date ?? "", author: author ?? "" };
    });
  } catch {
    return [];
  }
}

async function field(name: string): Promise<string> {
  try {
    return (await fs.readFile(path.join(DIR, name), "utf8")).trim();
  } catch {
    return "";
  }
}

export async function updaterConfigured(): Promise<boolean> {
  if (!DIR) return false;
  try {
    await fs.access(DIR);
    return true;
  } catch {
    return false;
  }
}

export async function readUpdateStatus(): Promise<UpdateStatus | null> {
  if (!(await updaterConfigured())) return null;
  const names = [
    "current_commit",
    "current_message",
    "current_date",
    "behind",
    "latest_commit",
    "latest_message",
    "state",
    "last_result",
    "last_checked",
    "previous_commit",
  ];
  const [cc, cm, cd, be, lc, lm, st, lr, ch, pv] = await Promise.all(names.map(field));
  return {
    configured: true,
    currentCommit: cc,
    currentMessage: cm,
    currentDate: cd,
    behind: Number(be || "0"),
    latestCommit: lc,
    latestMessage: lm,
    state: st || "idle",
    lastResult: lr,
    lastChecked: ch,
    previousCommit: pv,
    pending: await readPending(),
  };
}

export async function writeUpdateRequest(cmd: "check" | "update" | "rollback"): Promise<boolean> {
  if (!DIR) return false;
  try {
    await fs.writeFile(path.join(DIR, "request"), cmd);
    return true;
  } catch {
    return false;
  }
}
