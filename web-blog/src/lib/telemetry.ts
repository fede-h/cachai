export interface ModelReleaseTelemetry {
  id: number;
  model_name: string;
  provider: string;
  release_date: string;
  audited: boolean;
  created_at: string;
}

export interface EvalRunTelemetry {
  id: number;
  model_id: number;
  model_name: string;
  provider: string;
  dataset_id: number;
  category: string;
  source: string;
  passed: boolean;
  score: number;
  cost_usd: number;
  created_at: string;
}

export interface BudgetTelemetry {
  daily_limit_usd: number;
  spend_24h_usd: number;
  remaining_usd: number;
  utilization_pct: number;
  source: "litellm" | "db_fallback" | "unavailable";
}

export interface TriggerDemoResponse {
  status: string;
  trigger_source: string;
  target_model: string | null;
  budget_approved: boolean;
  budget_remaining_usd: number;
  budget_reason: string;
  evaluations_run: number;
  published_post_slug: string | null;
  errors: string[];
}

export interface TelemetryResult<T> {
  data: T;
  error: string | null;
}

const FALLBACK_BUDGET: BudgetTelemetry = {
  daily_limit_usd: 0,
  spend_24h_usd: 0,
  remaining_usd: 0,
  utilization_pct: 0,
  source: "unavailable",
};

function getServerApiBaseUrl(): string {
  return (
    process.env.AGENT_CORE_URL ||
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_AGENT_CORE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000"
  ).replace(/\/$/, "");
}

function getClientApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_AGENT_CORE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000"
  ).replace(/\/$/, "");
}

export async function fetchModels(): Promise<
  TelemetryResult<ModelReleaseTelemetry[]>
> {
  try {
    const res = await fetch(`${getServerApiBaseUrl()}/api/models`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        data: [],
        error: `Failed to fetch model releases (HTTP ${res.status}).`,
      };
    }
    const data: ModelReleaseTelemetry[] = await res.json();
    return { data, error: null };
  } catch {
    return {
      data: [],
      error: "Agent core service is currently unreachable.",
    };
  }
}

export async function fetchRuns(
  limit = 25
): Promise<TelemetryResult<EvalRunTelemetry[]>> {
  try {
    const res = await fetch(
      `${getServerApiBaseUrl()}/api/runs?limit=${encodeURIComponent(String(limit))}`,
      {
        cache: "no-store",
      }
    );
    if (!res.ok) {
      return {
        data: [],
        error: `Failed to fetch evaluation runs (HTTP ${res.status}).`,
      };
    }
    const data: EvalRunTelemetry[] = await res.json();
    return { data, error: null };
  } catch {
    return {
      data: [],
      error: "Agent core service is currently unreachable.",
    };
  }
}

export async function fetchBudget(): Promise<TelemetryResult<BudgetTelemetry>> {
  try {
    const res = await fetch(`${getServerApiBaseUrl()}/api/budget`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        data: FALLBACK_BUDGET,
        error: `Failed to fetch budget telemetry (HTTP ${res.status}).`,
      };
    }
    const data: BudgetTelemetry = await res.json();
    return { data, error: null };
  } catch {
    return {
      data: FALLBACK_BUDGET,
      error: "Agent core service is currently unreachable.",
    };
  }
}

export async function triggerDemoAudit(): Promise<TriggerDemoResponse> {
  const res = await fetch(`${getClientApiBaseUrl()}/api/trigger-demo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    let detail = `Audit cycle request failed (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string" && body.detail.trim().length > 0) {
        detail = body.detail;
      }
    } catch {
      // Ignore JSON parsing failure and preserve default HTTP error message.
    }
    throw new Error(detail);
  }

  return (await res.json()) as TriggerDemoResponse;
}
