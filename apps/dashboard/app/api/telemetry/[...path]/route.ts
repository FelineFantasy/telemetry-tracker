import { dashboardApiFetch } from "@/lib/dashboard-api";

const ALLOWED_ROOTS = new Set(["sessions", "events", "errors"]);
const SAFE_SEGMENT_RE = /^[a-z]+$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await context.params;
  if (
    path.length !== 1 ||
    !SAFE_SEGMENT_RE.test(path[0]!) ||
    !ALLOWED_ROOTS.has(path[0]!)
  ) {
    return new Response("Not found", { status: 404 });
  }

  const search = new URL(request.url).search;
  const apiPath = `/api/${path[0]}${search}`;
  const upstream = await dashboardApiFetch(apiPath);
  const body = await upstream.text();

  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
