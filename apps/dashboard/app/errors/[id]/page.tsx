const API_BASE = process.env.API_URL || "http://localhost:3001";

async function getErrorGroup(id: string) {
  const res = await fetch(`${API_BASE}/api/errors/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export default async function ErrorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let group: Awaited<ReturnType<typeof getErrorGroup>>;
  try {
    group = await getErrorGroup(id);
  } catch (e) {
    return (
      <div>
        <h1>Error detail</h1>
        <p style={{ color: "crimson" }}>Could not load this error. Check that the API is reachable.</p>
        <pre style={{ fontSize: 12, overflow: "auto" }}>{String(e instanceof Error ? e.message : e)}</pre>
      </div>
    );
  }
  if (!group) return <div><h1>Error not found</h1></div>;
  return (
    <div>
      <h1>Error detail</h1>
      <p><strong>Message:</strong> {group.message}</p>
      {group.top_stack && (
        <div>
          <strong>Top stack:</strong>
          <pre style={{ background: "#f5f5f5", padding: 12, overflow: "auto" }}>{group.top_stack}</pre>
        </div>
      )}
      <p>Occurrences: <strong>{group.occurrences}</strong></p>
      <p>First seen: {new Date(group.first_seen).toLocaleString()}</p>
      <p>Last seen: {new Date(group.last_seen).toLocaleString()}</p>
      <h2>Recent occurrences</h2>
      {group.occurrences_list?.length ? (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {group.occurrences_list.map((o: { id: string; created_at: string; stack?: string; context?: unknown }) => (
            <li key={o.id} style={{ marginBottom: 16, padding: 12, background: "#f9f9f9", borderRadius: 4 }}>
              <div>{new Date(o.created_at).toLocaleString()}</div>
              {o.stack && <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{o.stack}</pre>}
              {o.context != null && typeof o.context === "object" && Object.keys(o.context).length > 0
                ? <pre style={{ fontSize: 12 }}>{JSON.stringify(o.context, null, 2)}</pre>
                : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>No occurrences listed.</p>
      )}
    </div>
  );
}
