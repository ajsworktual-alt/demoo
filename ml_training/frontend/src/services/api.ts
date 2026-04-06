export interface RecordItem {
  id: number;
  title: string;
  owner: string;
  status: string;
  priority: string;
  summary: string;
  score: number;
}

export interface DashboardSummary {
  open_items: number;
  active_owners: number;
  attention_needed: number;
  records: RecordItem[];
}

export interface InsightResponse {
  label: string;
  confidence: number;
  recommendation: string;
}

export async function fetchDashboard() {
  const response = await fetch('/api/v1/dashboard');
  if (!response.ok) throw new Error('Failed to load dashboard');
  return response.json() as Promise<DashboardSummary>;
}

export async function fetchInsight(summary: string) {
  const response = await fetch('/api/v1/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary }),
  });
  if (!response.ok) throw new Error('Failed to load insight');
  return response.json() as Promise<InsightResponse>;
}
