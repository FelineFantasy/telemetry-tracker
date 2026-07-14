"use client";

/** Same-origin proxy to the telemetry API (forwards httpOnly session cookies server-side). */
export async function dashboardApiClientFetch(
  pathAndQuery: string,
  init?: RequestInit
): Promise<Response> {
  const trimmed = pathAndQuery.startsWith("/api/")
    ? pathAndQuery.slice("/api/".length)
    : pathAndQuery.replace(/^\//, "");

  return fetch(`/api/telemetry/${trimmed}`, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: {
      ...init?.headers,
    },
  });
}
