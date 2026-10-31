import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "UniTrack — Your academic workspace",
  description: "A private workspace for university tasks and announcements.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
