import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard, Calendar, Network, MapPin, Trees, School, GraduationCap,
  UserCog, Users, HeartHandshake, BookOpen, ClipboardCheck,
  Wallet, Banknote, Undo2, ShieldCheck, BarChart3, Bell, Activity,
  ScrollText, Settings, Menu, X, LogOut, Search, ChevronDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// Separate nav items for regular and expandable menus
const regularNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/academic-years", label: "Academic Years", icon: Calendar },
  { to: "/clusters", label: "Clusters", icon: Network },
  { to: "/schools", label: "Schools", icon: School },
  { to: "/colleges", label: "Colleges", icon: GraduationCap },
] as const;

const expandableNav = [
  {
    label: "Attendance",
    icon: ClipboardCheck,
    children: [
      { to: "/attendance/students", label: "Students Attendance" },
      { to: "/attendance/volunteers", label: "Volunteers Attendance" },
      { to: "/attendance/homework", label: "Homework" },
    ],
  },
] as const;

const moreNav = [
  { to: "/admins", label: "User Management", icon: UserCog },
  { to: "/students", label: "Students", icon: Users },
  { to: "/volunteers", label: "Volunteers", icon: HeartHandshake },
  { to: "/sessions", label: "Sessions", icon: BookOpen },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/advance", label: "Advance", icon: Banknote },
  { to: "/refunds", label: "Refunds", icon: Undo2 },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/timeline", label: "Timeline", icon: Activity },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function SidebarBody({ onNav }: { onNav?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Attendance: false });

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg gradient-secondary font-black text-sidebar-primary-foreground">
          T
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">TQI Admin</div>
          <div className="truncate text-[11px] text-sidebar-foreground/60">Command Center</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {/* Regular nav items */}
        {regularNav.map((item) => {
          const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNav}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-card"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        {/* User Management header */}
        <div className="mt-4 px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
          User Management
        </div>

        {/* Expandable Attendance menu */}
        {expandableNav.map((item) => {
          const isExpanded = expanded[item.label];
          const Icon = item.icon;
          const hasActiveChild = item.children.some((child) => pathname === child.to || pathname.startsWith(child.to));

          return (
            <div key={item.label}>
              <button
                onClick={() => {
                  setExpanded({ ...expanded, [item.label]: !isExpanded });
                }}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  hasActiveChild
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-card"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1 text-left">{item.label}</span>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    isExpanded && "rotate-90",
                  )}
                />
              </button>

              {isExpanded && (
                <div className="ml-2 space-y-1 border-l border-sidebar-border/50 pl-2">
                  {item.children.map((child) => {
                    const childActive = pathname === child.to || pathname.startsWith(child.to);
                    return (
                      <Link
                        key={child.to}
                        to={child.to}
                        onClick={onNav}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          childActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-card"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        )}
                      >
                        <span className="truncate">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* More nav items */}
        {moreNav.map((item) => {
          const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNav}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-card"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3 text-[11px] text-sidebar-foreground/60">
        v1.0 • TQI © 2026
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const notifications = useStore((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read).length;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  
  // Find current nav item label
  let currentLabel = "Dashboard";
  
  // Check regular nav
  for (const item of regularNav) {
    if (item.to === pathname || (item.to !== "/" && pathname.startsWith(item.to))) {
      currentLabel = item.label;
      break;
    }
  }
  
  // Check expandable nav children
  if (currentLabel === "Dashboard") {
    for (const item of expandableNav) {
      const childMatch = item.children.find((c) => c.to === pathname);
      if (childMatch) {
        currentLabel = childMatch.label;
        break;
      }
    }
  }
  
  // Check more nav
  if (currentLabel === "Dashboard") {
    for (const item of moreNav) {
      if (item.to === pathname || (item.to !== "/" && pathname.startsWith(item.to))) {
        currentLabel = item.label;
        break;
      }
    }
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarBody />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 bg-sidebar p-0">
          <SidebarBody onNav={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>TQI</span>
              <span>/</span>
              <span className="truncate font-medium text-foreground">{currentLabel}</span>
            </div>
            <h1 className="hidden truncate text-base font-semibold sm:block">{currentLabel}</h1>
          </div>
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search anything…" className="h-9 w-64 pl-8" />
          </div>
          <Link to="/notifications">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-secondary px-1 text-[10px] font-bold text-secondary-foreground">
                  {unread}
                </span>
              )}
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary text-primary-foreground text-xs">AM</AvatarFallback></Avatar>
                <span className="hidden text-sm font-medium sm:inline">Aarav M</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Aarav Mehta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/settings">Settings</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/audit-logs">Activity</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/login"><LogOut className="h-4 w-4" />Sign out</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title, description, actions, badge,
}: { title: string; description?: string; actions?: React.ReactNode; badge?: string }) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-xl font-bold sm:text-2xl">{title}</h2>
          {badge && <Badge variant="secondary" className="shrink-0">{badge}</Badge>}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export { X };
