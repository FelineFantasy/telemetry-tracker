import { redirect } from "next/navigation";
import { serializeSearchParams } from "../../lib/search-params";

/**
 * `/dashboard` forwards to `/dashboard/overview` with the same query string.
 */
export default async function DashboardRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(`/dashboard/overview${serializeSearchParams(params)}`);
}
