"use client";

import { useMemo, useState } from "react";
import type { LeaderboardEntry } from "@/lib/leaderboard";

type SortField = "avg_score" | "pass_rate" | "total_cost_usd";
type SortDirection = "asc" | "desc";

const MAX_COMPARE = 3;

interface SafetyGrade {
  grade: string;
  label: string;
  className: string;
}

function getSafetyGrade(entry: LeaderboardEntry): SafetyGrade {
  if (entry.total_evals === 0) {
    return {
      grade: "N/A",
      label: "Pending evaluation",
      className: "border-slate-700 bg-slate-800/80 text-slate-400",
    };
  }
  if (entry.avg_score >= 0.9) {
    return {
      grade: "A",
      label: "Grade A (90%+)",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    };
  }
  if (entry.avg_score >= 0.8) {
    return {
      grade: "B",
      label: "Grade B (80-89%)",
      className: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    };
  }
  if (entry.avg_score >= 0.7) {
    return {
      grade: "C",
      label: "Grade C (70-79%)",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    };
  }
  if (entry.avg_score >= 0.6) {
    return {
      grade: "D",
      label: "Grade D (60-69%)",
      className: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    };
  }
  return {
    grade: "F",
    label: "Grade F (<60%)",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  };
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function formatPercent(ratio: number): string {
  return `${(clampRatio(ratio) * 100).toFixed(1)}%`;
}

function formatUsd(amount: number, decimals = 4): string {
  if (!Number.isFinite(amount)) return "$0.0000";
  return `$${amount.toFixed(decimals)}`;
}

function formatCategory(category: string): string {
  return category.replace(/_/g, " ");
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

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getScoreBarColor(score: number): string {
  const ratio = clampRatio(score);
  if (ratio >= 0.85) return "bg-emerald-400";
  if (ratio >= 0.7) return "bg-amber-400";
  return "bg-rose-500";
}

interface LeaderboardClientProps {
  entries: LeaderboardEntry[];
  error: string | null;
}

export default function LeaderboardClient({
  entries,
  error,
}: LeaderboardClientProps) {
  const [sortField, setSortField] = useState<SortField>("avg_score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDirection(field === "total_cost_usd" ? "asc" : "desc");
    }
  }

  function handleToggleSelect(modelId: number) {
    setSelectedIds((prev) => {
      if (prev.includes(modelId)) {
        return prev.filter((id) => id !== modelId);
      }
      if (prev.length >= MAX_COMPARE) {
        return prev;
      }
      return [...prev, modelId];
    });
  }

  function handleClearSelection() {
    setSelectedIds([]);
  }

  const sortedEntries = useMemo(() => {
    const copy = [...entries];
    copy.sort((a, b) => {
      const diff = a[sortField] - b[sortField];
      if (diff !== 0) {
        return sortDirection === "asc" ? diff : -diff;
      }
      const scoreFallback = b.avg_score - a.avg_score;
      if (scoreFallback !== 0) return scoreFallback;
      return a.model_name.localeCompare(b.model_name);
    });
    return copy;
  }, [entries, sortField, sortDirection]);

  const selectedModels = useMemo(() => {
    const entryMap = new Map(entries.map((entry) => [entry.model_id, entry]));
    return selectedIds
      .map((id) => entryMap.get(id))
      .filter((entry): entry is LeaderboardEntry => Boolean(entry));
  }, [entries, selectedIds]);

  const comparisonCategories = useMemo(() => {
    const categorySet = new Set<string>();
    for (const model of selectedModels) {
      for (const category of Object.keys(model.categories ?? {})) {
        categorySet.add(category);
      }
    }
    return Array.from(categorySet).sort((a, b) => a.localeCompare(b));
  }, [selectedModels]);

  const auditedCount = useMemo(
    () => entries.filter((entry) => entry.audited || entry.total_evals > 0).length,
    [entries]
  );

  function getAriaSort(field: SortField): "ascending" | "descending" | "none" {
    if (sortField !== field) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  }

  function renderSortIndicator(field: SortField) {
    if (sortField !== field) {
      return (
        <span aria-hidden="true" className="ml-1 text-slate-600">
          ↕
        </span>
      );
    }
    return (
      <span aria-hidden="true" className="ml-1 text-emerald-400">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  const comparisonGridClass =
    selectedModels.length === 1
      ? "grid-cols-1"
      : selectedModels.length === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  const selectionLimitReached = selectedIds.length >= MAX_COMPARE;

  return (
    <div className="space-y-8">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200"
        >
          <p className="font-semibold text-amber-300">
            Leaderboard Connectivity Notice
          </p>
          <p className="mt-1 text-amber-200/90">{error}</p>
        </div>
      )}

      {/* Side-by-Side Comparison Panel */}
      {selectedModels.length > 0 && (
        <section
          aria-labelledby="comparison-heading"
          className="rounded-xl border border-emerald-500/30 bg-slate-900/70 p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id="comparison-heading"
                className="text-lg font-semibold text-white"
              >
                Side-by-Side Comparison
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Comparing {selectedModels.length} of {MAX_COMPARE} models across
                safety metrics and benchmark categories.
                {selectedModels.length < 2 &&
                  " Select up to 2 more models from the table below."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearSelection}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
            >
              Clear ({selectedModels.length})
            </button>
          </div>

          <div className={`mt-5 grid gap-4 ${comparisonGridClass}`}>
            {selectedModels.map((model) => {
              const grade = getSafetyGrade(model);
              return (
                <article
                  key={model.model_id}
                  className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-mono text-sm font-semibold text-white">
                          {model.model_name}
                        </h3>
                        <p className="mt-0.5 text-xs capitalize text-slate-400">
                          {model.provider}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          title={grade.label}
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${grade.className}`}
                        >
                          {grade.grade}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(model.model_id)}
                          aria-label={`Remove ${model.model_name} from comparison`}
                          className="rounded-md p-1 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-2.5">
                      <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                        <dt className="text-[11px] text-slate-400">
                          Avg Score
                        </dt>
                        <dd className="mt-1 font-mono text-base font-semibold text-white">
                          {model.total_evals > 0
                            ? formatPercent(model.avg_score)
                            : "—"}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                        <dt className="text-[11px] text-slate-400">
                          Pass Rate
                        </dt>
                        <dd className="mt-1 font-mono text-base font-semibold text-emerald-400">
                          {model.total_evals > 0
                            ? formatPercent(model.pass_rate)
                            : "—"}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                        <dt className="text-[11px] text-slate-400">
                          Evaluations
                        </dt>
                        <dd className="mt-1 font-mono text-sm font-medium text-slate-200">
                          {model.passed_evals} / {model.total_evals}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                        <dt className="text-[11px] text-slate-400">
                          Total Cost
                        </dt>
                        <dd className="mt-1 font-mono text-sm font-medium text-slate-200">
                          {formatUsd(model.total_cost_usd)}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-5">
                      <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">
                        Category Breakdown
                      </h4>
                      {comparisonCategories.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500">
                          No category evaluations recorded yet.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-3">
                          {comparisonCategories.map((category) => {
                            const metrics = model.categories?.[category];
                            if (!metrics) {
                              return (
                                <li key={category} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="capitalize text-slate-400">
                                      {formatCategory(category)}
                                    </span>
                                    <span className="font-mono text-[11px] text-slate-500">
                                      Not evaluated
                                    </span>
                                  </div>
                                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/70" />
                                </li>
                              );
                            }

                            const pct = clampRatio(metrics.avg_score) * 100;
                            return (
                              <li key={category} className="space-y-1">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="truncate capitalize text-slate-200">
                                    {formatCategory(category)}
                                  </span>
                                  <span className="shrink-0 font-mono text-[11px] text-slate-300">
                                    {pct.toFixed(1)}%{" "}
                                    <span className="text-slate-500">
                                      ({metrics.passed}/{metrics.total})
                                    </span>
                                  </span>
                                </div>
                                <div
                                  className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
                                  role="progressbar"
                                  aria-valuenow={Math.round(pct)}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-label={`${model.model_name} ${formatCategory(category)} score`}
                                >
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${getScoreBarColor(metrics.avg_score)}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>

                  <p className="mt-4 border-t border-slate-800/80 pt-3 font-mono text-[11px] text-slate-500">
                    Last audited: {formatTimestamp(model.last_audited_at)}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Sortable Leaderboard Table */}
      <section
        aria-labelledby="leaderboard-table-heading"
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="leaderboard-table-heading"
              className="text-lg font-semibold text-white"
            >
              Safety Rankings
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Select up to {MAX_COMPARE} models to compare category-level
              red-teaming scores side by side.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectionLimitReached && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                Max {MAX_COMPARE} selected
              </span>
            )}
            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 font-mono text-xs text-slate-300">
              {auditedCount} / {entries.length} audited
            </span>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="mt-5 rounded-lg border border-slate-800/80 bg-slate-950/40 p-8 text-center">
            <p className="text-sm text-slate-300">
              No models available on the leaderboard yet.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Run an autonomous audit cycle from the Telemetry dashboard to
              populate safety rankings.
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-3 font-medium">Compare</th>
                  <th className="pb-3 pr-3 font-medium">#</th>
                  <th className="pb-3 pr-4 font-medium">Model</th>
                  <th className="pb-3 pr-4 text-center font-medium">Grade</th>
                  <th
                    className="pb-3 pr-4 text-right font-medium"
                    aria-sort={getAriaSort("avg_score")}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("avg_score")}
                      className="inline-flex items-center uppercase tracking-wider text-slate-400 transition hover:text-white"
                    >
                      Avg Score
                      {renderSortIndicator("avg_score")}
                    </button>
                  </th>
                  <th
                    className="pb-3 pr-4 text-right font-medium"
                    aria-sort={getAriaSort("pass_rate")}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("pass_rate")}
                      className="inline-flex items-center uppercase tracking-wider text-slate-400 transition hover:text-white"
                    >
                      Pass Rate
                      {renderSortIndicator("pass_rate")}
                    </button>
                  </th>
                  <th
                    className="pb-3 text-right font-medium"
                    aria-sort={getAriaSort("total_cost_usd")}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("total_cost_usd")}
                      className="inline-flex items-center uppercase tracking-wider text-slate-400 transition hover:text-white"
                    >
                      Cost
                      {renderSortIndicator("total_cost_usd")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {sortedEntries.map((entry, index) => {
                  const grade = getSafetyGrade(entry);
                  const isSelected = selectedIds.includes(entry.model_id);
                  const isDisabled = selectionLimitReached && !isSelected;

                  return (
                    <tr
                      key={entry.model_id}
                      className={`transition hover:bg-slate-800/30 ${
                        isSelected ? "bg-emerald-500/5" : ""
                      }`}
                    >
                      <td className="py-3.5 pr-3">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(entry.model_id)}
                          disabled={isDisabled}
                          aria-pressed={isSelected}
                          aria-label={
                            isSelected
                              ? `Remove ${entry.model_name} from comparison`
                              : `Select ${entry.model_name} for comparison`
                          }
                          title={
                            isDisabled
                              ? `Maximum of ${MAX_COMPARE} models can be compared at once`
                              : isSelected
                                ? "Remove from comparison"
                                : "Add to comparison"
                          }
                          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                            isSelected
                              ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                              : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          }`}
                        >
                          {isSelected ? "Selected" : "Compare"}
                        </button>
                      </td>
                      <td className="py-3.5 pr-3 font-mono text-xs text-slate-500">
                        {index + 1}
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="font-mono text-xs font-medium text-white sm:text-sm">
                          {entry.model_name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="capitalize">{entry.provider}</span>
                          {entry.release_date && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-[11px]">
                                {formatDateOnly(entry.release_date)}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 text-center">
                        <span
                          title={grade.label}
                          className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${grade.className}`}
                        >
                          {grade.grade}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono text-xs font-medium text-white">
                        {entry.total_evals > 0
                          ? formatPercent(entry.avg_score)
                          : "—"}
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono text-xs">
                        {entry.total_evals > 0 ? (
                          <div>
                            <div className="font-medium text-slate-200">
                              {formatPercent(entry.pass_rate)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {entry.passed_evals}/{entry.total_evals}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3.5 text-right font-mono text-xs text-slate-300">
                        {formatUsd(entry.total_cost_usd)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
