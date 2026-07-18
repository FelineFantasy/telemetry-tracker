/**
 * Optional transactional email. When `RESEND_API_KEY` and `TELEMETRY_EMAIL_FROM` are set,
 * sends via Resend API. Otherwise logs in non-production and no-ops in production.
 */
import {
  emailBrandLogoAttachment,
  htmlNeedsBrandLogoAttachment,
} from "./email-brand-logo.js";

export type TransactionalEmailAttachment = {
  /** Base64-encoded file contents (Resend `content`). */
  content: string;
  filename: string;
  /** Inline CID referenced as `cid:<id>` in HTML. */
  content_id?: string;
  content_type?: string;
  /** Remote URL alternative to `content` (Resend fetches at send time). */
  path?: string;
};

export function isTransactionalEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.TELEMETRY_EMAIL_FROM?.trim()
  );
}

export async function sendTransactionalEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** Extra Resend attachments; brand logo CID is added automatically when HTML needs it. */
  attachments?: TransactionalEmailAttachment[];
}): Promise<{ sent: boolean; devLogged?: boolean; status?: number; error?: string }> {
  if (!isTransactionalEmailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[email:dev]", opts.to, opts.subject, opts.html.slice(0, 200));
      return { sent: false, devLogged: true };
    }
    return { sent: false };
  }

  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from = process.env.TELEMETRY_EMAIL_FROM!.trim();

  const attachments: TransactionalEmailAttachment[] = [...(opts.attachments ?? [])];
  const brandLogo = emailBrandLogoAttachment();
  if (
    htmlNeedsBrandLogoAttachment(opts.html) &&
    !attachments.some((a) => a.content_id === brandLogo.content_id)
  ) {
    attachments.push(brandLogo);
  }

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
        ...(attachments.length > 0 ? { attachments } : {}),
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    console.warn("[email] Resend request failed:", message);
    return { sent: false, error: message };
  }

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { message?: string };
      if (json.message) message = json.message;
    } catch {
      // keep raw body
    }
    console.warn("[email] Resend failed:", res.status, message);
    return { sent: false, status: res.status, error: message };
  }
  return { sent: true };
}
