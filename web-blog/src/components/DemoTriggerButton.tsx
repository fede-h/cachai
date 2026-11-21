"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  triggerDemoAudit,
  type TriggerDemoResponse,
} from "@/lib/telemetry";

function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

export default function DemoTriggerButton() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TriggerDemoResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  async function handleTrigger() {
    if (isRunning) return;

    setIsRunning(true);
    setRequestError(null);

    try {
      const response = await triggerDemoAudit();
      setResult(response);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to reach the agent-core service.";
      setRequestError(message);
    } finally {
      setIsRunning(false);
    }
  }

  const hasErrors = Boolean(result && result.errors.length > 0);
  const bannerTone =
    result && (!result.budget_approved || hasErrors)
      ? "border-amber-500/40 bg-amber-500/10"
      : "border-emerald-500/40 bg-emerald-500/10";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleTrigger}
          disabled={isRunning}
          aria-busy={isRunning}
          className="inline-flex items-center gap-2.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRunning ? (
            <>
              <svg
                className="h-4 w-4 animate-spin text-slate-950"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Running Audit Cycle...
            </>
          ) : (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-slate-950" />
              Run Live Audit Cycle
            </>
          )}
        </button>

        {isRunning && (
          <span className="text-xs text-slate-400">
            Executing multi-agent discovery, budget check, sandboxed evals, and
            report publishing...
          </span>
        )}
      </div>

      {requestError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200"
        >
          <p className="font-semibold text-rose-300">Audit Trigger Failed</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-200/90">
            {requestError}
          </p>
        </div>
      )}

      {result && (
        <div
          role="status"
          className={`rounded-xl border p-4 text-sm ${bannerTone}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">
                Audit Cycle Result
              </span>
              <span className="rounded bg-slate-900/80 px-2 py-0.5 font-mono text-xs text-slate-200">
                {result.status}
              </span>
            </div>
            {result.published_post_slug && (
              <Link
                href={`/posts/${result.published_post_slug}`}
                className="text-xs font-semibold text-emerald-300 underline decoration-emerald-400/50 underline-offset-4 hover:text-emerald-200"
              >
                View Published Report &rarr;
              </Link>
            )}
          </div>

          <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
              <dt className="text-slate-400">Target Model</dt>
              <dd className="mt-1 font-mono font-medium text-white">
                {result.target_model ?? "None selected"}
              </dd>
            </div>

            <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
              <dt className="text-slate-400">Budget Guardrail</dt>
              <dd className="mt-1 flex items-center gap-2 font-mono font-medium">
                <span
                  className={
                    result.budget_approved
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }
                >
                  {result.budget_approved ? "Approved" : "Blocked"}
                </span>
                <span className="text-slate-400">
                  ({formatUsd(result.budget_remaining_usd)} left)
                </span>
              </dd>
            </div>

            <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
              <dt className="text-slate-400">Evaluations Run</dt>
              <dd className="mt-1 font-mono font-medium text-white">
                {result.evaluations_run}
              </dd>
            </div>
          </dl>

          {result.budget_reason && (
            <p className="mt-3 text-xs text-slate-300">
              <span className="font-medium text-slate-400">Budget note:</span>{" "}
              {result.budget_reason}
            </p>
          )}

          {hasErrors && (
            <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-950/40 p-3">
              <p className="text-xs font-semibold text-rose-300">
                Pipeline Warnings / Errors ({result.errors.length})
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-rose-200/90">
                {result.errors.map((errMsg, index) => (
                  <li key={`${index}-${errMsg}`}>{errMsg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
