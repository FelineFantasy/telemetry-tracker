import { dashboardApiFetch } from "@/lib/dashboard-api";

const ALLOWED_ROOTS = new Set(["sessions", "events", "errors"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await context.params;
  const root = path[0];
  if (!root || !ALLOWED_ROOTS.has(root)) {
    return new Response("Not found", { status: 404 });
  }

  const search = new URL(request.url).search;
  const apiPath = `/api/${path.join("/")}${search}`;
  const upstream = await dashboardApiFetch(apiPath);
  const body = await upstream.text();

  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
