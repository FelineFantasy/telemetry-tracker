const API_BASE = process.env.API_URL || "http://localhost:3001";

async function getOverview() {
  const res = await fetch(`${API_BASE}/api/overview`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch overview");
  return res.json();
}

export default async function OverviewPage() {
  const data = await getOverview();
  return (
    <div>
      <h1>Overview</h1>
      <section style={{ marginBottom: 32 }}>
        <h2>Last 24 hours</h2>
        <p>Errors: <strong>{data.errorsLast24h}</strong></p>
        <p>Events: <strong>{data.eventsLast24h}</strong></p>
      </section>
      <section style={{ marginBottom: 32 }}>
        <h2>Top error groups</h2>
        {data.topErrorGroups?.length ? (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {data.topErrorGroups.map((g: { id: string; message: string; occurrences: number; last_seen: string }) => (
              <li key={g.id} style={{ marginBottom: 8 }}>
                <a href={`/errors/${g.id}`}>{g.message}</a> — {g.occurrences} occurrences (last: {new Date(g.last_seen).toLocaleString()})
              </li>
            ))}
          </ul>
        ) : (
          <p>No errors yet.</p>
        )}
      </section>
      <section>
        <h2>Top events</h2>
        {data.topEvents?.length ? (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {data.topEvents.map((e: { name: string; count: number }) => (
              <li key={e.name}>{e.name}: {e.count}</li>
            ))}
          </ul>
        ) : (
          <p>No events yet.</p>
        )}
      </section>
    </div>
  );
}
