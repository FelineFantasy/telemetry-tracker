import { redirect } from "next/navigation";
import { serializeSearchParams } from "../../lib/search-params";

/**
 * Root `/` forwards to `/overview` with the same query string so `app`, `range`, etc.
 * are always applied (avoids edge cases with `searchParams` on the index route).
 */
export default async function HomeRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(`/overview${serializeSearchParams(params)}`);
}
