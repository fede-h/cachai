import type { Metadata } from "next";
import LeaderboardClient from "@/components/LeaderboardClient";
import { fetchLeaderboard } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard | CachAI Red-Team Log",
  description:
    "Model safety rankings, red-teaming pass rates, and side-by-side category comparisons across audited LLMs.",
};

export default async function LeaderboardPage() {
  const { data, error } = await fetchLeaderboard();

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Model Safety Leaderboard
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
          Comparative safety grades, red-teaming pass rates, and evaluation
          costs across tracked LLM releases. Sort rankings or select up to three
          models to compare category performance side by side.
        </p>
      </section>

      <LeaderboardClient entries={data} error={error} />
    </div>
  );
}
