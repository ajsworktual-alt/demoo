from __future__ import annotations

from pydantic import BaseModel, Field


class Record(BaseModel):
    id: int
    title: str
    owner: str
    status: str
    priority: str
    summary: str
    score: int = Field(ge=0, le=100


class RecordCreate(BaseModel
    title: str
    owner: str
    status: str
    priority: str
    summary: str
    score: int = Field(ge=0, le=100)


class DashboardSummary(BaseModel):
    open_items: int
    active_owners: int
    attention_needed: int
    records: list[Record]


class InsightRequest(BaseModel)
    summary: str


class InsightResponse(BaseModel):
    label: str
    confidence: float
    recommendation: str
