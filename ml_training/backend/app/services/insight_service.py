from __future__ import annotations

from app.schemas import InsightResponse


def generate_insight(summary: str) -> InsightResponse:
    lowered = summary.lower()
    if any(word in lowered for word in ("risk", "blocked", "delay", "issue")):
        return InsightResponse(
            label="risk",
            confidence=0.86,
            recommendation="Escalate the blockers, assign an owner, and add a recovery milestone.",
        )
    if any(word in lowered for word in ("growth", "expand", "launch", "adoption")):
        return InsightResponse(
            label="opportunity",
            confidence=0.8,
            recommendation="Translate the opportunity into a concrete action plan with measurable outcomes.",
        )
    return InsightResponse(
        label="monitor",
        confidence=0.72,
        recommendation="Track progress with a weekly update and capture the next decision point.",
    )
