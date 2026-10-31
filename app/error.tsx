"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ApplicationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="flex min-h-screen items-center justify-center px-4 py-12"><section className="w-full max-w-md rounded-2xl border bg-card p-7 text-center shadow-sm"><span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-800"><AlertCircle className="size-5" aria-hidden="true" /></span><h1 className="mt-4 text-xl font-semibold">This page could not load</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Your data is still protected. Try again, or return to the overview.</p><div className="mt-5 flex justify-center gap-2"><Button onClick={reset} type="button" variant="outline">Try again</Button><Link className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90" href="/">Overview</Link></div></section></main>;
}
