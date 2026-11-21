from typing import Any

from langgraph.graph import END, START, StateGraph

from app.agents.accountant import accountant_node
from app.agents.auditor import auditor_node
from app.agents.orchestrator import orchestrator_node
from app.agents.scraper import scraper_node
from app.agents.state import AuditGraphState


def _route_after_orchestrator(state: AuditGraphState) -> str:
    if state.get("target_model") is None:
        return END
    return "accountant"


def _route_after_accountant(state: AuditGraphState) -> str:
    if not state.get("budget_approved", False):
        return END
    return "auditor"


def build_audit_graph():
    graph = StateGraph(AuditGraphState)

    graph.add_node("scraper", scraper_node)
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("accountant", accountant_node)
    graph.add_node("auditor", auditor_node)

    graph.add_edge(START, "scraper")
    graph.add_edge("scraper", "orchestrator")
    graph.add_conditional_edges(
        "orchestrator",
        _route_after_orchestrator,
        {"accountant": "accountant", END: END},
    )
    graph.add_conditional_edges(
        "accountant",
        _route_after_accountant,
        {"auditor": "auditor", END: END},
    )
    graph.add_edge("auditor", END)

    return graph.compile()


audit_graph = build_audit_graph()


def run_audit_cycle(trigger_source: str = "scheduler") -> dict[str, Any]:
    initial_state: AuditGraphState = {
        "trigger_source": trigger_source,
        "scraped_models": 0,
        "scraped_prompts": 0,
        "target_model": None,
        "budget_approved": False,
        "budget_remaining_usd": 0.0,
        "budget_reason": "",
        "eval_results": [],
        "published_post_slug": None,
        "errors": [],
    }
    return audit_graph.invoke(initial_state)
