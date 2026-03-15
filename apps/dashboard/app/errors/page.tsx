const API_BASE = process.env.API_URL || "http://localhost:3001";

async function getErrors() {
  const res = await fetch(`${API_BASE}/api/errors`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch errors");
  return res.json();
}

export default async function ErrorsListPage() {
  const { items } = await getErrors();
  return (
    <div>
      <h1>Errors</h1>
      {items?.length ? (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {items.map((g: { id: string; message: string; top_stack?: string; occurrences: number; first_seen: string; last_seen: string }) => (
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
