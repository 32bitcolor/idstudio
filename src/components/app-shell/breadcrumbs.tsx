"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SECTION_LABELS } from "@/lib/modules";

// Detail pages register their entity's live name so the trailing crumb can show
// it (the URL only carries an opaque id). Cleared automatically on unmount.
const PageTitleContext = createContext<{
  title: string | null;
  setTitle: (title: string | null) => void;
}>({ title: null, setTitle: () => {} });

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const value = useMemo(() => ({ title, setTitle }), [title]);
  return (
    <PageTitleContext.Provider value={value}>
      {children}
    </PageTitleContext.Provider>
  );
}

/** Call from a detail view to drive the trailing breadcrumb crumb. */
export function useSetPageTitle(title: string) {
  const { setTitle } = useContext(PageTitleContext);
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const { title } = useContext(PageTitleContext);

  const segments = pathname.split("/").filter(Boolean);
  const section = segments[0];
  const sectionLabel = section ? SECTION_LABELS[section] : undefined;

  // Unknown top-level route — render nothing rather than a guess.
  if (!sectionLabel) return null;

  const isDetail = segments.length > 1;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isDetail ? (
            <BreadcrumbLink asChild>
              <Link href={`/${section}`}>{sectionLabel}</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{sectionLabel}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {isDetail && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[40vw] truncate sm:max-w-xs">
                {title ?? <span className="text-muted-foreground">…</span>}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
