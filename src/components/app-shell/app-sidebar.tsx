"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Cable,
  ChevronsUpDown,
  Columns3,
  Film,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
} from "lucide-react";

import { logout } from "@/app/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

// Feature areas. `href` marks a module that's live; the rest are upcoming phases.
type NavItem = { name: string; href?: string; icon: LucideIcon; phase: string };

const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, phase: "" },
  { name: "Boards", href: "/boards", icon: Columns3, phase: "Phase 1" },
  { name: "Projects", href: "/projects", icon: FolderKanban, phase: "Phase 2" },
  { name: "Storyboards", href: "/storyboards", icon: Film, phase: "Phase 3" },
  { name: "Exams", href: "/exams", icon: GraduationCap, phase: "Phase 4" },
  { name: "LMS Integration", icon: Cable, phase: "Phase 5" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({
  workspaceName,
  userLabel,
  userEmail,
  role,
}: {
  workspaceName: string;
  userLabel: string;
  userEmail: string;
  role: string;
}) {
  const pathname = usePathname();
  const initial = (userLabel || userEmail || "?").charAt(0).toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="text-sm font-semibold">ID</span>
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">IDStudio</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {workspaceName}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const active = item.href ? isActive(pathname, item.href) : false;
              return (
                <SidebarMenuItem key={item.name}>
                  {item.href ? (
                    <SidebarMenuButton asChild isActive={active} tooltip={item.name}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      tooltip={`${item.name} · coming soon`}
                      className="cursor-default opacity-50"
                      aria-disabled
                    >
                      <item.icon />
                      <span>{item.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        Soon
                      </span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted text-sm font-medium">
                    {initial}
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{userLabel}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="truncate text-sm font-medium">{userLabel}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      Role: {role}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <form action={logout}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full cursor-pointer">
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
