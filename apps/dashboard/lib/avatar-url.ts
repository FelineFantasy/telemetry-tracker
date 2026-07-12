/** Map API avatar paths to same-origin dashboard proxy routes for `<img>` tags. */
export function toDashboardAvatarUrl(apiAvatarUrl: string | null | undefined): string | null {
  if (!apiAvatarUrl) return null;
  const match = apiAvatarUrl.match(/^\/api\/auth\/avatars\/([^?]+)(\?.*)?$/);
  if (!match) return apiAvatarUrl;
  return `/avatar/${match[1]}${match[2] ?? ""}`;
}
