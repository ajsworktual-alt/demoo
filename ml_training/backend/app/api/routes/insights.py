from fastapi import APIRouter

from app.schemas import InsightRequest, InsightResponse
from app.services.insight_service import generate_insight

router = APIRouter(tags=["insights"])


@router.post("/insights", response_model=InsightResponse)
async def create_insight(payload: InsightRequest) -> InsightResponse:
    return generate_insight(payload.summary)
