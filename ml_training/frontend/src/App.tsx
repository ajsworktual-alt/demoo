import { useEffect, useState } from 'react';
import { DashboardSummary, fetchDashboard, fetchInsight, InsightResponse } from './services/api';

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [insight, setInsight] = useState<InsightResponse | null>(null);

  useEffect(() => {
    void fetchDashboard().then(async result => {
      setDashboard(result);
      if (result.records[0]) {
        const nextInsight = await fetchInsight(result.records[0].summary);
        setInsight(nextInsight);
      }
    });
  }, []);

  return (
    <main className="workspace-shell">
      <section className="hero">
        <p className="eyebrow">Operational Workspace</p>
        <h1>Ml Training</h1>
        <p>Structured FastAPI + React/Vite starter for a production-style business platform.</p>
      </section>

      <section className="metrics">
        <article><strong>{dashboard?.open_items ?? 0}</strong><span>Open items</span></article>
        <article><strong>{dashboard?.active_owners ?? 0}</strong><span>Active owners</span></article>
        <article><strong>{dashboard?.attention_needed ?? 0}</strong><span>Need attention</span></article>
      </section>

      <section className="board">
        <div className="records">
          <h2>Records</h2>
          {dashboard?.records.map(record => (
            <article key={record.id} className="card">
              <header>
                <strong>{record.title}</strong>
                <span>{record.status}</span>
              </header>
              <p>{record.summary}</p>
              <footer>
                <span>{record.owner}</span>
                <span>Score {record.score}</span>
              </footer>
            </article>
          ))}
        </div>

        <aside className="insight-panel">
          <h2>Insight</h2>
          <p className="label">{insight?.label ?? 'loading'}</p>
          <p>{insight?.recommendation ?? 'Generating the first insight…'}</p>
        </aside>
      </section>
    </main>
  );
}
