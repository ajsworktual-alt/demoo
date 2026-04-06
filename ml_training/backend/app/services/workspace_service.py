from __future__ import annotations

from app.schemas import DashboardSummary, Record, RecordCreate


class WorkspaceService:
    def __init__(self) -> None:
        self._records: list[Record] = [
            Record(
                id=1,
                title="Launch the onboarding revamp",
                owner="Ava",
                status="In Progress",
                priority="High",
                summary="Coordinate rollout milestones, content, and feedback checkpoints.",
                score=82,
            ),
            Record(
                id=2,
                title="Stabilize analytics imports",
                owner="Liam",
                status="Review",
                priority="Medium",
                summary="Investigate ingestion quality and close the failed sync gaps.",
                score=61,
            ),
        ]

    def list_records(self) -> list[Record]:
        return self._records

    def create_record(self, payload: RecordCreate) -> Record:
        record = Record(id=len(self._records) + 1, **payload.model_dump())
        self._records.append(record)
        return record

    def dashboard(self) -> DashboardSummary:
        return DashboardSummary(
            open_items=len(self._records),
            active_owners=len({record.owner for record in self._records}),
            attention_needed=len([record for record in self._records if record.score < 70]),
            records=self._records,
        )


workspace_service = WorkspaceService()
