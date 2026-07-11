"use client";

import { useSetPageTitle } from "@/components/app-shell/breadcrumbs";

/** Drives the trailing breadcrumb crumb on a help article (server page passes the title). */
export function HelpCrumb({ title }: { title: string }) {
  useSetPageTitle(title);
  return null;
}
