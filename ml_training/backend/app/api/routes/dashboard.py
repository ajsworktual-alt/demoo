from fastapi import APIRouter

from app.schemas import DashboardSummary
from app.services.workspace_service import workspace_service

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard() -> DashboardSummary:
    return workspace_service.dashboard()
