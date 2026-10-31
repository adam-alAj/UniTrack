import { GraduationCap } from "lucide-react";
import { redirect } from "next/navigation";

import { signIn } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const hasSupabaseConfig =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const params = await searchParams;

  if (hasSupabaseConfig) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="bg-card w-full max-w-[420px] rounded-2xl border p-7 shadow-sm sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
            <GraduationCap className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">UniTrack</p>
            <p className="text-muted-foreground text-sm">
              Your academic workspace
            </p>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Sign in to view your private courses and deadlines.
        </p>

        {!hasSupabaseConfig ? (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Supabase is not configured yet. Copy <code>.env.example</code> to{" "}
            <code>.env.local</code> and add your project URL and anon key to
            enable sign-in.
          </div>
        ) : (
          <form action={signIn} className="mt-7 space-y-4">
            <label
              className="block space-y-2 text-sm font-medium"
              htmlFor="email"
            >
              Email address
              <input
                autoComplete="email"
                className="bg-background focus-visible:ring-ring h-11 w-full rounded-lg border px-3 font-normal transition outline-none focus-visible:ring-2"
                id="email"
                name="email"
                required
                type="email"
              />
            </label>
            <label
              className="block space-y-2 text-sm font-medium"
              htmlFor="password"
            >
              Password
              <input
                autoComplete="current-password"
                className="bg-background focus-visible:ring-ring h-11 w-full rounded-lg border px-3 font-normal transition outline-none focus-visible:ring-2"
                id="password"
                name="password"
                required
                type="password"
              />
            </label>
            {params.error && (
              <p aria-live="polite" className="text-destructive text-sm">
                {params.error}
              </p>
            )}
            <Button className="w-full" type="submit">
              Sign in
            </Button>
          </form>
        )}

        <p className="text-muted-foreground mt-6 text-center text-xs leading-5">
          Access is limited to the account configured for this workspace.
        </p>
      </section>
    </main>
  );
}
