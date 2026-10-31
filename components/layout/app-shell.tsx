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
  Search,
  Settings2,
} from "lucide-react";

import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, selected: true },
  { label: "Tasks", icon: CheckSquare2 },
  { label: "Calendar", icon: CalendarDays },
  { label: "Courses", icon: BookOpen },
  { label: "Announcements", icon: Bell },
  { label: "Email & Sync", icon: Mail },
];

export function AppShell({ email }: { email: string }) {
  const today = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Africa/Cairo",
  }).format(new Date());

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden border-r bg-sidebar lg:flex lg:flex-col">
        <div className="flex h-[76px] items-center gap-3 border-b px-6">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold tracking-tight">UniTrack</p>
            <p className="text-xs text-muted-foreground">Academic workspace</p>
          </div>
        </div>
        <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3 py-6">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Workspace
          </p>
          {navigation.map(({ label, icon: Icon, selected }) => (
            <a
              aria-current={selected ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${selected ? "bg-accent font-medium text-accent-foreground" : "text-sidebar-foreground hover:bg-muted"}`}
              href={selected ? "/" : "#"}
              key={label}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              {label}
              {label === "Tasks" && (
                <span className="ml-auto text-xs text-muted-foreground">0</span>
              )}
            </a>
          ))}
        </nav>
        <div className="space-y-1 border-t p-3">
          <a className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground hover:bg-muted" href="#">
            <Settings2 className="size-[18px]" aria-hidden="true" /> Settings
          </a>
          <a className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground hover:bg-muted" href="#">
            <CircleHelp className="size-[18px]" aria-hidden="true" /> Help & support
          </a>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b bg-card/95 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <GraduationCap className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold lg:hidden">UniTrack</p>
              <p className="hidden text-sm text-muted-foreground sm:block">{today}</p>
              <p className="text-lg font-semibold tracking-tight sm:hidden">Overview</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden h-10 w-56 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground md:flex">
              <Search className="size-4" aria-hidden="true" />
              <span>Search your workspace</span>
              <kbd className="ml-auto rounded border bg-card px-1.5 py-0.5 text-[10px]">⌘ K</kbd>
            </div>
            <Button aria-label="Notifications" className="text-muted-foreground" size="icon" variant="ghost">
              <Bell className="size-[18px]" aria-hidden="true" />
            </Button>
            <div className="hidden h-8 w-px bg-border sm:block" />
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-1.5 hover:bg-muted">
                <span className="flex size-8 items-center justify-center rounded-full bg-[#e9edfa] text-xs font-semibold text-[#4058a8]">U</span>
                <span className="hidden max-w-36 truncate text-sm sm:block">{email}</span>
                <ChevronDown className="hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
              </summary>
              <form action={signOut} className="absolute right-0 top-12 w-48 rounded-xl border bg-card p-2 shadow-lg">
                <Button className="w-full justify-start" variant="ghost">Log out</Button>
              </form>
            </details>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] p-5 sm:p-8">
          <div className="mb-8 hidden items-end justify-between sm:flex">
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Your semester, at a glance</p>
              <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
            </div>
            <Button className="gap-2">
              <CheckSquare2 className="size-4" aria-hidden="true" /> Add a task
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Open tasks", value: "—", note: "Tasks will appear here" },
              { label: "Due soon", value: "—", note: "Coming up in the next 7 days" },
              { label: "Upcoming exams", value: "—", note: "Stay ready for exam day" },
              { label: "Completed", value: "—", note: "Your finished work" },
            ].map((item) => (
              <section className="rounded-xl border bg-card p-5 shadow-sm shadow-slate-200/30" key={item.label}>
                <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{item.value}</p>
                <p className="mt-2 text-xs text-muted-foreground">{item.note}</p>
              </section>
            ))}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(290px,1fr)]">
            <section className="rounded-xl border bg-card shadow-sm shadow-slate-200/30">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h2 className="font-semibold">Upcoming tasks</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Your next deadlines will show up here</p>
                </div>
                <a className="text-sm font-medium text-primary" href="#">View all</a>
              </div>
              <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
                <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <CheckSquare2 className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-sm font-medium">A clear week starts here</h3>
                <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">Your academic tasks will appear once your workspace is connected.</p>
              </div>
            </section>

            <section className="rounded-xl border bg-card shadow-sm shadow-slate-200/30">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold">Recent announcements</h2>
                <p className="mt-1 text-xs text-muted-foreground">Updates from your courses</p>
              </div>
              <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
                <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Mail className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-sm font-medium">Nothing new just yet</h3>
                <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">Course updates will be collected here when email sync is set up.</p>
              </div>
            </section>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-xl border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Mail className="size-4" aria-hidden="true" /></span>
              <div><p className="text-sm font-medium">Email sync</p><p className="text-xs text-muted-foreground">Connect your university inbox to get started</p></div>
            </div>
            <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Not connected</span>
          </div>
          <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t bg-card px-1 pb-[env(safe-area-inset-bottom)] pt-2 lg:hidden">
            {navigation.slice(0, 5).map(({ label, icon: Icon, selected }) => (
              <a className={`flex flex-col items-center gap-1 px-1 py-1.5 text-[10px] ${selected ? "font-medium text-primary" : "text-muted-foreground"}`} href={selected ? "/" : "#"} key={label}>
                <Icon className="size-[18px]" aria-hidden="true" />{label}
              </a>
            ))}
          </nav>
        </main>
      </div>
    </div>
  );
}
