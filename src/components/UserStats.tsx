import React, { useEffect, useState } from "react";

type Summary = {
  totalUsers: number;
  activeUsers: number;
  totalEvents: number;
  eventCounts: Record<string, number>;
  lastUpdated: string | null;
};

export default function UserStats() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadSummary() {
    setLoading(true);
    try {
      const res = await fetch("/api/user-stats/summary");
      const json = await res.json();
      setSummary(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents() {
    try {
      const res = await fetch("/api/user-stats/activity?limit=20");
      const json = await res.json();
      setEvents(json.events || []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadSummary();
    loadEvents();
  }, []);

  async function simulateEvent() {
    try {
      const userId = `user_${Math.floor(Math.random() * 20) + 1}`;
      const types = ["login", "answer_question", "generate_question", "proofread", "export_docx"];
      const eventType = types[Math.floor(Math.random() * types.length)];
      const res = await fetch("/api/user-stats/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, eventType, metadata: { simulated: true } }),
      });
      await loadSummary();
      await loadEvents();
      return await res.json();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div style={{ padding: 12, maxWidth: 900 }}>
      <h3>لوحة إحصاءات المستخدمين</h3>
      {loading && <div>جاري التحميل...</div>}
      {summary ? (
        <div>
          <div>المستخدمون الكلي: {summary.totalUsers}</div>
          <div>مستخدمون نشطون (30 يوم): {summary.activeUsers}</div>
          <div>إجمالي الأحداث: {summary.totalEvents}</div>
          <div>تفصيل حسب نوع الحدث:</div>
          <ul>
            {Object.entries(summary.eventCounts).map(([k, v]) => (
              <li key={k}>{k}: {v}</li>
            ))}
          </ul>
          <div>آخر تحديث: {summary.lastUpdated || "—"}</div>
        </div>
      ) : (
        <div>لا توجد بيانات بعد.</div>
      )}

      <div style={{ marginTop: 12 }}>
        <button onClick={simulateEvent}>محاكاة حدث مستخدم</button>
        <button onClick={() => { loadSummary(); loadEvents(); }} style={{ marginLeft: 8 }}>تحديث</button>
      </div>

      <h4 style={{ marginTop: 16 }}>آخر الأحداث</h4>
      <div>
        {events.length === 0 && <div>لا توجد أحداث بعد.</div>}
        <ul>
          {events.map((e) => (
            <li key={e.id}>
              <b>{e.eventType}</b> — {e.userId} — <small>{new Date(e.ts).toLocaleString()}</small>
              <div style={{ fontSize: 12, color: "#444" }}>{JSON.stringify(e.metadata)}</div>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 16 }}>
        <small>ملاحظة: استورد هذا المكون داخل App.tsx لعرض الأداة في الواجهة.</small>
      </div>
    </div>
  );
}
