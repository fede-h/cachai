import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CachAI | Continuous LLM Security Audit Reports",
  description:
    "Autonomous multi-agent red-teaming and safety evaluation reports for newly released LLMs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased selection:bg-emerald-500/30">
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
              CachAI Red-Team Log
            </Link>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300">
              Autonomous Audits
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
