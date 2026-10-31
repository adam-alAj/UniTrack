import Link from "next/link";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare2,
  ChevronDown,
  CircleHelp,
  GraduationCap,
  LayoutDashboard,
  Mail,
  Settings2,
} from "lucide-react";

import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

const navigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard, active: "overview" },
  { label: "Tasks", href: "/tasks", icon: CheckSquare2, active: "tasks" },
  {
    label: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    active: "calendar",
  },
  { label: "Courses", href: "/courses", icon: BookOpen, active: "courses" },
  {
    label: "Announcements",
    href: "/announcements",
    icon: Bell,
    active: "announcements",
  },
  { label: "Email & Sync", href: "/sync", icon: Mail, active: "sync" },
];

export function AppShell({
  email,
  activeSection,
  children,
}: {
  email: string;
  activeSection:
    "overview" | "tasks" | "calendar" | "courses" | "announcements" | "sync";
  children: React.ReactNode;
}) {
  const today = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Africa/Cairo",
  }).format(new Date());
  const pageTitle = {
    overview: "Overview",
    tasks: "Tasks",
    calendar: "Calendar",
    courses: "Courses",
    announcements: "Announcements",
    sync: "Email & Sync",
  }[activeSection];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="bg-sidebar hidden border-r lg:flex lg:flex-col">
        <Link
          className="flex h-[76px] items-center gap-3 border-b px-6"
          href="/"
        >
          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block font-semibold tracking-tight">UniTrack</span>
            <span className="text-muted-foreground block text-xs">
              Academic workspace
            </span>
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-1 px-3 py-6"
        >
          <p className="text-muted-foreground px-3 pb-2 text-[11px] font-semibold tracking-[0.12em] uppercase">
            Workspace
          </p>
          {navigation.map(({ label, href, icon: Icon, active }) =>
            href && active ? (
              <Link
                aria-current={active === activeSection ? "page" : undefined}
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm ${active === activeSection ? "bg-accent text-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-muted"}`}
                href={href!}
                key={label}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
                {label}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="text-muted-foreground/70 flex h-10 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm"
                key={label}
                title="Available in a later phase"
              >
                <Icon className="size-[18px]" aria-hidden="true" />
                {label}
                <span className="ml-auto text-[10px]">Soon</span>
              </span>
            ),
          )}
        </nav>
        <div className="space-y-1 border-t p-3">
          <span className="text-muted-foreground flex h-10 items-center gap-3 px-3 text-sm">
            <Settings2 className="size-[18px]" aria-hidden="true" />
            Settings
          </span>
          <span className="text-muted-foreground flex h-10 items-center gap-3 px-3 text-sm">
            <CircleHelp className="size-[18px]" aria-hidden="true" />
            Help & support
          </span>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="bg-card/95 sticky top-0 z-10 flex h-[68px] items-center justify-between border-b px-4 backdrop-blur sm:h-[76px] sm:px-8">
          <div className="flex items-center gap-3">
            <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl lg:hidden">
              <GraduationCap className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-muted-foreground text-sm">{today}</p>
              <p className="text-lg font-semibold tracking-tight sm:hidden">
                {pageTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              className="bg-background text-muted-foreground hover:text-foreground hidden h-10 items-center gap-2 rounded-lg border px-3 text-sm md:flex"
              href="/tasks"
            >
              <CheckSquare2 className="size-4" aria-hidden="true" />
              <span>Find a task</span>
            </Link>
            <div className="bg-border hidden h-8 w-px sm:block" />
            <details className="relative">
              <summary className="hover:bg-muted flex cursor-pointer list-none items-center gap-2 rounded-lg p-1.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-[#e9edfa] text-xs font-semibold text-[#4058a8]">
                  {email.charAt(0).toLocaleUpperCase() || "U"}
                </span>
                <span className="hidden max-w-44 truncate text-sm sm:block">
                  {email}
                </span>
                <ChevronDown
                  className="text-muted-foreground hidden size-4 sm:block"
                  aria-hidden="true"
                />
              </summary>
              <form
                action={signOut}
                className="bg-card absolute top-12 right-0 w-48 rounded-xl border p-2 shadow-lg"
              >
                <Button className="w-full justify-start" variant="ghost">
                  Log out
                </Button>
              </form>
            </details>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 pt-5 pb-24 sm:px-8 sm:py-8 lg:pb-8">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-muted-foreground mb-1 text-sm">
                {activeSection === "overview"
                  ? "Your semester, at a glance"
                  : "Keep your deadlines and progress in one place"}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                {pageTitle}
              </h1>
            </div>
            {activeSection === "overview" && (
              <Link
                className="text-primary hidden text-sm font-medium hover:underline sm:block"
                href="/tasks"
              >
                View all tasks →
              </Link>
            )}
          </div>
          {children}
        </main>
        <nav
          aria-label="Mobile navigation"
          className="bg-card fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t px-1 pt-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {navigation.map(
            ({ label, href, icon: Icon, active }) =>
              href &&
              active && (
                <Link
                  aria-current={active === activeSection ? "page" : undefined}
                  className={`flex min-w-16 flex-1 flex-col items-center gap-1 px-1 py-1.5 text-[10px] ${active === activeSection ? "text-primary font-medium" : "text-muted-foreground"}`}
                  href={href}
                  key={label}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  {label}
                </Link>
              ),
          )}
        </nav>
      </div>
    </div>
  );
}
