import type { Metadata } from "next";
import DemoTriggerButton from "@/components/DemoTriggerButton";
import {
  fetchBudget,
  fetchModels,
  fetchRuns,
  type BudgetTelemetry,
} from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Telemetry | CachAI Red-Team Log",
  description:
    "Live budget guardrails, tracked LLM releases, and sandboxed evaluation run telemetry.",
};

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatUsd(amount: number, decimals = 4): string {
  return `$${amount.toFixed(decimals)}`;
}

function formatScorePct(score: number): string {
  const normalized = score <= 1 ? score * 100 : score;
  return `${normalized.toFixed(1)}%`;
}

function formatCategory(category: string): string {
  return category.replace(/_/g, " ");
}

function getSourceBadge(source: BudgetTelemetry["source"]): {
  label: string;
  className: string;
} {
  switch (source) {
    case "litellm":
      return {
        label: "source: litellm",
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      };
    case "db_fallback":
      return {
        label: "source: db_fallback",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      };
    default:
      return {
        label: "source: unavailable",
        className: "border-slate-700 bg-slate-800/80 text-slate-400",
      };
  }
}

function getBarColor(utilizationPct: number): string {
  if (utilizationPct >= 90) return "bg-rose-500";
  if (utilizationPct >= 70) return "bg-amber-400";
  return "bg-emerald-400";
}

export default async function TelemetryPage() {
  const [modelsResult, runsResult, budgetResult] = await Promise.all([
    fetchModels(),
    fetchRuns(25),
    fetchBudget(),
  ]);

  const models = modelsResult.data;
  const runs = runsResult.data;
  const budget = budgetResult.data;

  const uniqueErrors = Array.from(
    new Set(
      [modelsResult.error, runsResult.error, budgetResult.error].filter(
        (msg): msg is string => Boolean(msg)
      )
    )
  );

  const clampedUtilization = Math.max(
    0,
    Math.min(100, Number.isFinite(budget.utilization_pct) ? budget.utilization_pct : 0)
  );
  const sourceBadge = getSourceBadge(budget.source);
  const auditedCount = models.filter((m) => m.audited).length;

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Live Telemetry &amp; Audit Control
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
            Real-time operational metrics from the autonomous red-teaming
            pipeline, including LiteLLM daily budget guardrails, discovered
            model releases, and sandboxed evaluation runs.
          </p>
        </div>

        <DemoTriggerButton />
      </section>

      {uniqueErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200"
        >
          <p className="font-semibold text-amber-300">
            Telemetry Connectivity Notice
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-200/90">
            {uniqueErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Budget Guardrail Gauge */}
      <section
        aria-labelledby="budget-guardrail-heading"
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="budget-guardrail-heading"
              className="text-lg font-semibold text-white"
            >
              Budget Guardrail Gauge
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Rolling 24-hour API spend enforced by the Accountant agent before
              every evaluation cycle.
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 font-mono text-xs font-medium ${sourceBadge.className}`}
          >
            {sourceBadge.label}
          </span>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-400">Daily Utilization</span>
            <span className="font-mono text-sm font-semibold text-white">
              {clampedUtilization.toFixed(1)}%
            </span>
          </div>
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-slate-800"
            role="progressbar"
            aria-valuenow={Math.round(clampedUtilization)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Daily budget utilization percentage"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${getBarColor(clampedUtilization)}`}
              style={{ width: `${clampedUtilization}%` }}
            />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">24h Spend</dt>
            <dd className="mt-1 font-mono text-xl font-semibold text-white">
              {formatUsd(budget.spend_24h_usd, 4)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">Remaining Budget</dt>
            <dd className="mt-1 font-mono text-xl font-semibold text-emerald-400">
              {formatUsd(budget.remaining_usd, 4)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">Daily Limit</dt>
            <dd className="mt-1 font-mono text-xl font-semibold text-slate-200">
              {formatUsd(budget.daily_limit_usd, 2)}
            </dd>
          </div>
        </dl>
      </section>

      {/* Tracked Model Releases Table */}
      <section
        aria-labelledby="tracked-models-heading"
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="tracked-models-heading"
              className="text-lg font-semibold text-white"
            >
              Tracked Model Releases
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Models discovered by the Scout agent and queued for autonomous
              red-teaming.
            </p>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 font-mono text-xs text-slate-300">
            {auditedCount} / {models.length} audited
          </span>
        </div>

        {models.length === 0 ? (
          <div className="mt-5 rounded-lg border border-slate-800/80 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
            No tracked model releases found yet.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4 font-medium">Model</th>
                  <th className="pb-3 pr-4 font-medium">Provider</th>
                  <th className="pb-3 pr-4 font-medium">Release Date</th>
                  <th className="pb-3 text-right font-medium">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {models.map((model) => (
                  <tr
                    key={model.id}
                    className="transition hover:bg-slate-800/30"
                  >
                    <td className="py-3 pr-4 font-mono text-xs font-medium text-white sm:text-sm">
                      {model.model_name}
                    </td>
                    <td className="py-3 pr-4 capitalize text-slate-300">
                      {model.provider}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-400">
                      {formatDateOnly(model.release_date)}
                    </td>
                    <td className="py-3 text-right">
                      {model.audited ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-medium text-emerald-300">
                          Audited
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-xs font-medium text-amber-300">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Evaluation Runs Table */}
      <section
        aria-labelledby="recent-runs-heading"
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="recent-runs-heading"
              className="text-lg font-semibold text-white"
            >
              Recent Evaluation Runs
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Latest sandboxed red-teaming evaluations across safety and
              robustness benchmarks.
            </p>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 font-mono text-xs text-slate-300">
            {runs.length} {runs.length === 1 ? "run" : "runs"}
          </span>
        </div>

        {runs.length === 0 ? (
          <div className="mt-5 rounded-lg border border-slate-800/80 bg-slate-950/40 p-8 text-center">
            <p className="text-sm text-slate-300">
              No evaluation runs recorded yet.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Click <span className="font-semibold text-emerald-400">Run Live Audit Cycle</span>{" "}
              above to execute the first autonomous red-teaming run.
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4 font-medium">Model</th>
                  <th className="pb-3 pr-4 font-medium">Category</th>
                  <th className="pb-3 pr-4 font-medium">Result</th>
                  <th className="pb-3 pr-4 text-right font-medium">Score</th>
                  <th className="pb-3 pr-4 text-right font-medium">Cost</th>
                  <th className="pb-3 text-right font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="transition hover:bg-slate-800/30"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-mono text-xs font-medium text-white">
                        {run.model_name}
                      </div>
                      <div className="text-xs capitalize text-slate-500">
                        {run.provider}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="capitalize text-slate-200">
                        {formatCategory(run.category)}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {run.source}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {run.passed ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-medium text-emerald-300">
                          Passed
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 font-mono text-xs font-medium text-rose-300">
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs font-medium text-white">
                      {formatScorePct(run.score)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs text-slate-300">
                      {formatUsd(run.cost_usd, 4)}
                    </td>
                    <td className="py-3 text-right font-mono text-xs text-slate-400">
                      <time dateTime={run.created_at}>
                        {formatTimestamp(run.created_at)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
