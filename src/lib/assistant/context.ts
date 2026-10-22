import "server-only";

// What the member is looking at, told to the model so "this card" or "summarize this
// round" just work. Only ids from the URL go in the prompt, never looked-up names: the
// model reads the item through the tools, which check access as usual.

export function describePage(path: string | undefined): string {
  if (!path) return "";
  let url: URL;
  try {
    url = new URL(path, "http://x");
  } catch {
    return "";
  }
  // A link someone sent could carry anything in its path; only id-shaped text goes in.
  const clean = (x: string | null | undefined) => (x ?? "").replace(/[^\w-]/g, "").slice(0, 40);
  const seg = url.pathname.split("/").filter(Boolean).map(clean);
  const card = clean(url.searchParams.get("card")) || null;
  const lines: string[] = [];

  switch (seg[0]) {
    case "boards":
      if (seg[1]) {
        lines.push(`They're on board board:${seg[1]}.`);
        if (card) lines.push(`They have card card:${card} open; "this card" means it.`);
      } else lines.push("They're on the Boards list.");
      break;
    case "c":
      if (seg[1]) lines.push(`They have card ${seg[1]} open; "this card" means it.`);
      break;
    case "projects":
      if (seg[1]) lines.push(`They're on project project:${seg[1]}; "this project" means it.`);
      else lines.push("They're on the Projects list.");
      break;
    case "storyboards":
      if (seg[1]) lines.push(`They have storyboard storyboard:${seg[1]} open; "this storyboard" means it.`);
      else lines.push("They're on the Storyboards list.");
      break;
    case "reviews":
      if (seg[1] === "feedback" && seg[2]) lines.push(`They're reading all feedback on deliverable deliverable:${seg[2]}.`);
      else if (seg[1]) lines.push(`They have review round review:${seg[1]} open; "this round" or "this review" means it.`);
      else lines.push("They're on the Reviews list.");
      break;
    case "intake":
      lines.push(seg[1] ? `They have intake request intake:${seg[1]} open.` : "They're on the Intake queue.");
      break;
    case "sprints":
      lines.push(seg[1] ? `They're on sprint ${seg[1]} (pass this id to get_sprint).` : "They're on the Sprints page.");
      break;
    case "my-work":
      lines.push("They're on My Work (get_my_work shows the same).");
      break;
    case "whiteboards":
      lines.push("They're on a whiteboard, which you can't read.");
      break;
    default:
      lines.push(`They're on /${seg.join("/")}.`);
  }
  return `Current page: ${lines.join(" ")}`;
}
