from datetime import datetime, timezone
import logging
import re
from typing import Any

import httpx

from app.agents.state import AuditGraphState
from app.config import get_settings
from app.db import get_db_connection
from app.services.litellm_client import LiteLLMClient
from app.services.sandbox import evaluate_in_sandbox

logger = logging.getLogger(__name__)


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug)


def _build_markdown_report(
    model: dict[str, Any],
    results: list[dict[str, Any]],
    total_cost: float,
    budget_reason: str,
) -> str:
    total = len(results)
    passed = sum(1 for item in results if item["passed"])
    avg_score = sum(item["score"] for item in results) / max(total, 1)

    lines = [
        f"# Security Audit Report: `{model['model_name']}`",
        "",
        f"- **Provider**: `{model['provider']}`",
        f"- **Release Date**: `{model['release_date']}`",
        f"- **Pass Rate**: `{passed}/{total}` ({(passed / max(total, 1)) * 100:.1f}%)",
        f"- **Average Score**: `{avg_score:.2f}` / `1.00`",
        f"- **Total Audit Cost**: `${total_cost:.6f} USD`",
        f"- **Budget Check**: {budget_reason}",
        "",
        "## Evaluation Breakdown",
        "",
        "| Category | Passed | Score | Sandbox Mode | Cost (USD) |",
        "| --- | --- | --- | --- | --- |",
    ]
    for item in results:
        status_label = "PASS" if item["passed"] else "FAIL"
        lines.append(
            f"| `{item['category']}` | {status_label} | {item['score']:.2f} | `{item['execution_mode']}` | `${item['cost_usd']:.6f}` |"
        )

    lines.extend(["", "## Sandbox Execution Logs", ""])
    for item in results:
        lines.extend(
            [
                f"### {item['category']}",
                "",
                "```text",
                item["logs"],
                "```",
                "",
            ]
        )

    return "\n".join(lines)


def auditor_node(state: AuditGraphState) -> dict[str, Any]:
    """Run eval_datasets against the target model, score in sandbox, store results, and publish report."""
    target_model = state.get("target_model")
    if not target_model:
        return {"eval_results": [], "published_post_slug": None}

    settings = get_settings()
    litellm_client = LiteLLMClient()
    errors = list(state.get("errors") or [])

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, category, prompt_text, source
                FROM eval_datasets
                ORDER BY id ASC
                LIMIT 10
                """
            )
            prompts = cur.fetchall()

    results: list[dict[str, Any]] = []
    last_eval_id: int | None = None
    total_cost = 0.0

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for item in prompts:
                completion = litellm_client.complete(
                    model_name=target_model["model_name"],
                    prompt=item["prompt_text"],
                    category=item["category"],
                )
                sandbox_res = evaluate_in_sandbox(
                    category=item["category"],
                    prompt_text=item["prompt_text"],
                    model_response=completion.content,
                )
                total_cost += completion.cost_usd

                cur.execute(
                    """
                    INSERT INTO eval_results (model_id, dataset_id, passed, score, logs, cost_usd)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        target_model["id"],
                        item["id"],
                        sandbox_res.passed,
                        sandbox_res.score,
                        f"[{completion.mode}] {sandbox_res.logs}",
                        completion.cost_usd,
                    ),
                )
                eval_row = cur.fetchone()
                last_eval_id = eval_row["id"]
                results.append(
                    {
                        "eval_id": last_eval_id,
                        "dataset_id": item["id"],
                        "category": item["category"],
                        "passed": sandbox_res.passed,
                        "score": sandbox_res.score,
                        "execution_mode": sandbox_res.execution_mode,
                        "cost_usd": completion.cost_usd,
                        "logs": sandbox_res.logs,
                    }
                )

            cur.execute(
                "UPDATE model_releases SET audited = TRUE WHERE id = %s",
                (target_model["id"],),
            )
        conn.commit()

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    slug = _slugify(f"audit-{target_model['provider']}-{target_model['model_name']}-{timestamp}")
    passed_count = sum(1 for r in results if r["passed"])
    title = f"Security Audit: {target_model['model_name']} ({target_model['provider']})"
    summary = (
        f"Automated red-teaming evaluation for {target_model['model_name']}: "
        f"{passed_count}/{len(results)} checks passed across isolated sandbox runs."
    )
    markdown_body = _build_markdown_report(
        model=target_model,
        results=results,
        total_cost=total_cost,
        budget_reason=state.get("budget_reason", "Approved"),
    )

    published_slug: str | None = None
    post_url = f"{settings.self_base_url.rstrip('/')}/api/posts"
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                post_url,
                headers={"X-Internal-Token": settings.internal_api_token},
                json={
                    "title": title,
                    "slug": slug,
                    "summary": summary,
                    "markdown_body": markdown_body,
                    "eval_id": last_eval_id,
                    "status": "published",
                },
            )
            resp.raise_for_status()
            published_slug = resp.json()["slug"]
            logger.info("Auditor published blog post: %s", published_slug)
    except Exception as exc:
        msg = f"Failed to publish audit report via {post_url}: {exc}"
        logger.error(msg)
        errors.append(msg)

    return {
        "eval_results": results,
        "published_post_slug": published_slug,
        "errors": errors,
    }
