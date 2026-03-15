const API_BASE = process.env.API_URL || "http://localhost:3001";

type ErrorGroupRow = {
  id: string;
  message: string;
  top_stack?: string;
  occurrences: number;
  first_seen: string;
  last_seen: string;
};

async function getErrors(): Promise<{ items: ErrorGroupRow[] }> {
  const res = await fetch(`${API_BASE}/api/errors`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function ApiError({ message }: { message: string }) {
  return (
    <div>
      <h1>Errors</h1>
      <p style={{ color: "crimson" }}>Could not load errors. Check that the API is reachable.</p>
      <pre style={{ fontSize: 12, overflow: "auto" }}>{message}</pre>
    </div>
  );
}

export default async function ErrorsListPage() {
  let items: ErrorGroupRow[];
  try {
    const data = await getErrors();
    items = data.items ?? [];
  } catch (e) {
    return <ApiError message={String(e instanceof Error ? e.message : e)} />;
  }
  return (
    <div>
      <h1>Errors</h1>
      {items.length ? (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {items.map((g) => (
            <li key={g.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #eee" }}>
              <a href={`/errors/${g.id}`} style={{ fontWeight: "bold" }}>{g.message}</a>
              {g.top_stack && <pre style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>{g.top_stack}</pre>}
              <span style={{ fontSize: 14, color: "#666" }}>{g.occurrences} occurrences · first {new Date(g.first_seen).toLocaleString()} · last {new Date(g.last_seen).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No error groups yet.</p>
      )}
    </div>
  );
}
