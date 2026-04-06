from fastapi import APIRouter, status

from app.schemas import Record, RecordCreate
from app.services.workspace_service import workspace_service

router = APIRouter(tags=["records"])


@router.get("/records", response_model=list[Record])
async def list_records() -> list[Record]:
    return workspace_service.list_records()


@router.post("/records", response_model=Record, status_code=status.HTTP_201_CREATED)
async def create_record(payload: RecordCreate) -> Record:
    return workspace_service.create_record(payload)
