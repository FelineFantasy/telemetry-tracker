const API_BASE = process.env.API_URL || "http://localhost:3001";

async function getOverview() {
  const url = `${API_BASE}/api/overview`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export default async function OverviewPage() {
  let data;
  try {
    data = await getOverview();
  } catch (e) {
    return (
      <div>
        <h1>Overview</h1>
        <p style={{ color: "crimson" }}>
          Could not load data from API. Check that <code>API_URL</code> is set correctly and the API is reachable.
        </p>
        <pre style={{ fontSize: 12, overflow: "auto" }}>{String(e instanceof Error ? e.message : e)}</pre>
      </div>
    );
  }
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
