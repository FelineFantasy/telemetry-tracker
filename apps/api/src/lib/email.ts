/**
 * Optional transactional email. When `RESEND_API_KEY` and `TELEMETRY_EMAIL_FROM` are set,
 * sends via Resend API. Otherwise logs in non-production and no-ops in production.
 */
export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; devLogged?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.TELEMETRY_EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[email:dev]", opts.to, opts.subject, opts.html.slice(0, 200));
      return { sent: false, devLogged: true };
    }
    return { sent: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!res.ok) {
    console.warn("[email] Resend failed:", res.status, await res.text());
    return { sent: false };
  }
  return { sent: true };
}
