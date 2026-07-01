import { requireUser, getActiveMembership } from "@/lib/dal";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { Breadcrumbs, PageTitleProvider } from "@/components/app-shell/breadcrumbs";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Centralized auth gate for every module in the (app) group.
  const user = await requireUser();
  const membership = await getActiveMembership();

  return (
    <SidebarProvider>
      <AppSidebar
        workspaceName={membership?.workspace.name ?? "No workspace"}
        userLabel={user.name ?? user.email}
        userEmail={user.email}
        role={membership?.role ?? "—"}
        isAdmin={membership?.role === "ADMIN"}
      />
      <SidebarInset>
        <PageTitleProvider>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumbs />
            <div className="ml-auto">
              <ThemeSwitcher />
            </div>
          </header>
          <div className="flex-1">{children}</div>
        </PageTitleProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
