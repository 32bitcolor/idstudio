// Absolute URL to a path in the app, for links in emails. Reads APP_URL (the
// public base, e.g. https://idstudio.haggabasin.com) — set in the app + worker
// env. Returns undefined when unset so templates simply omit the link.
export function appUrl(path: string): string | undefined {
  const base = process.env.APP_URL?.replace(/\/+$/, "");
  if (!base) return undefined;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
