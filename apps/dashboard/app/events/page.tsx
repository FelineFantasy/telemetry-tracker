const API_BASE = process.env.API_URL || "http://localhost:3001";

async function getEvents() {
  const res = await fetch(`${API_BASE}/api/events`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

export default async function EventsPage() {
  const { items } = await getEvents();
  return (
    <div>
      <h1>Events</h1>
      {items?.length ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>App</th>
              <th style={{ padding: 8 }}>User ID</th>
              <th style={{ padding: 8 }}>Session ID</th>
              <th style={{ padding: 8 }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e: { id: string; name: string; app: string; user_id?: string; session_id?: string; created_at: string }) => (
              <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{e.name}</td>
                <td style={{ padding: 8 }}>{e.app}</td>
                <td style={{ padding: 8 }}>{e.user_id ?? "—"}</td>
                <td style={{ padding: 8 }}>{e.session_id ?? "—"}</td>
                <td style={{ padding: 8 }}>{new Date(e.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No events yet.</p>
      )}
    </div>
  );
}
