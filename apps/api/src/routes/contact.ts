import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { sendTransactionalEmail } from "../lib/email.js";

const CONTACT_INBOX =
  process.env.CONTACT_INBOX_EMAIL?.trim() || "info@tacko.io";

const TOPICS = new Set(["general", "support", "security", "business", "other"]);

const TOPIC_LABELS: Record<string, string> = {
  general: "General",
  support: "Support",
  security: "Security",
  business: "Business",
  other: "Other",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type ContactBody = {
  name?: string;
  email?: string;
  company?: string;
  topic?: string;
  message?: string;
};

function parseContactBody(body: ContactBody) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "general";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Required";
  else if (name.length > 100) errors.name = "Too long";
  if (!email) errors.email = "Required";
  else if (!isValidEmail(email)) errors.email = "Invalid email";
  if (company.length > 120) errors.company = "Too long";
  if (message.length < 10) errors.message = "Tell us a bit more";
  else if (message.length > 2000) errors.message = "Too long";
  if (!TOPICS.has(topic)) errors.topic = "Invalid topic";

  return { name, email, company, topic, message, errors };
}

function emailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.TELEMETRY_EMAIL_FROM?.trim()
  );
}

export async function contactRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.post("/contact", async (request, reply) => {
    const parsed = parseContactBody((request.body ?? {}) as ContactBody);
    if (Object.keys(parsed.errors).length > 0) {
      return reply.status(400).send({ error: "Validation failed", fields: parsed.errors });
    }

    const { name, email, company, topic, message } = parsed;
    const topicLabel = TOPIC_LABELS[topic] ?? topic;

    if (!emailConfigured()) {
      if (process.env.NODE_ENV !== "production") {
        console.info("[contact:dev]", { name, email, company, topic, message });
        return reply.send({
          ok: true,
          devLogged: true,
          inboxSent: false,
          confirmationSent: false,
        });
      }
      return reply.status(503).send({
        error: `Contact email is not configured. Email us directly at ${CONTACT_INBOX}.`,
      });
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeCompany = company ? escapeHtml(company) : "";
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

    const inboxHtml = [
      `<p><strong>Topic:</strong> ${escapeHtml(topicLabel)}</p>`,
      `<p><strong>Name:</strong> ${safeName}</p>`,
      `<p><strong>Email:</strong> ${safeEmail}</p>`,
      safeCompany ? `<p><strong>Company:</strong> ${safeCompany}</p>` : "",
      `<p><strong>Message:</strong></p><p>${safeMessage}</p>`,
    ]
      .filter(Boolean)
      .join("");

    const inboxResult = await sendTransactionalEmail({
      to: CONTACT_INBOX,
      replyTo: email,
      subject: `Telemetry Tracker — ${topicLabel} from ${name}`,
      html: inboxHtml,
    });

    if (!inboxResult.sent) {
      return reply.status(502).send({
        error: `Could not deliver your message. Try emailing ${CONTACT_INBOX} directly.`,
      });
    }

    const confirmationResult = await sendTransactionalEmail({
      to: email,
      subject: "We received your message — Telemetry Tracker",
      html: `<p>Hi ${safeName},</p><p>Thanks for reaching out about <strong>${escapeHtml(topicLabel)}</strong>. We received your message and will reply within one business day.</p><p>— Telemetry Tracker</p>`,
    });

    return reply.send({
      ok: true,
      inboxSent: inboxResult.sent,
      confirmationSent: confirmationResult.sent,
    });
  });
}
