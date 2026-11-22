export interface CategoryMetrics {
  avg_score: number;
  passed: number;
  total: number;
}

export interface LeaderboardEntry {
  model_id: number;
  model_name: string;
  provider: string;
  release_date: string | null;
  audited: boolean;
  total_evals: number;
  passed_evals: number;
  pass_rate: number;
  avg_score: number;
  total_cost_usd: number;
  last_audited_at: string | null;
  categories: Record<string, CategoryMetrics>;
}

export interface LeaderboardResult {
  data: LeaderboardEntry[];
  error: string | null;
}

function getServerApiBaseUrl(): string {
  return (
    process.env.AGENT_CORE_URL ||
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_AGENT_CORE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000"
  ).replace(/\/$/, "");
}

export async function fetchLeaderboard(): Promise<LeaderboardResult> {
  try {
    const res = await fetch(`${getServerApiBaseUrl()}/api/leaderboard`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        data: [],
        error: `Failed to fetch leaderboard data (HTTP ${res.status}).`,
      };
    }
    const payload: unknown = await res.json();
    if (!Array.isArray(payload)) {
      return {
        data: [],
        error: "Received unexpected leaderboard response format.",
      };
    }
    return { data: payload as LeaderboardEntry[], error: null };
  } catch {
    return {
      data: [],
      error: "Agent core service is currently unreachable.",
    };
  }
}
