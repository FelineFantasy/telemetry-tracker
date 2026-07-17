import { describe, expect, it } from "vitest";
import {
  buildAlertDeliveryBody,
  buildDiscordWebhookBody,
  buildMicrosoftTeamsWebhookBody,
  buildSlackIncomingWebhookBody,
  buildTelegramSendMessageBody,
  parseTelegramWebhookConfig,
  validateProviderWebhookUrl,
} from "./alert-webhook-channel-payload.js";

const sample = {
  deliveryId: "d1",
  projectId: "p1",
  rule: "ERROR_SPIKE" as const,
  title: "Error spike detected",
  body: "42 errors in 15m",
  href: "/dashboard/errors",
  dedupeKey: "k1",
};

describe("validateProviderWebhookUrl", () => {
  it("accepts Slack Incoming Webhook URLs", () => {
    expect(
      validateProviderWebhookUrl(
        "SLACK",
        "https://hooks.slack.com/services/T00/B00/xxx"
      )
    ).toEqual({ ok: true });
  });

  it("rejects non-Slack hosts for SLACK provider", () => {
    const result = validateProviderWebhookUrl(
      "SLACK",
      "https://example.com/services/T00/B00/xxx"
    );
    expect(result.ok).toBe(false);
  });

  it("accepts Discord webhook paths", () => {
    expect(
      validateProviderWebhookUrl(
        "DISCORD",
        "https://discord.com/api/webhooks/123456789012345678/token-here"
      )
    ).toEqual({ ok: true });
  });

  it("accepts Teams Incoming Webhook and Power Automate hosts", () => {
    expect(
      validateProviderWebhookUrl(
        "MICROSOFT_TEAMS",
        "https://contoso.webhook.office.com/webhookb2/abc"
      )
    ).toEqual({ ok: true });
    expect(
      validateProviderWebhookUrl(
        "MICROSOFT_TEAMS",
        "https://outlook.office.com/webhook/abc"
      )
    ).toEqual({ ok: true });
    expect(
      validateProviderWebhookUrl(
        "MICROSOFT_TEAMS",
        "https://prod-12.westus.logic.azure.com:443/workflows/abc"
      )
    ).toEqual({ ok: true });
  });

  it("rejects non-webhook Office hosts for MICROSOFT_TEAMS", () => {
    expect(
      validateProviderWebhookUrl(
        "MICROSOFT_TEAMS",
        "https://forms.office.com/Pages/ResponsePage.aspx"
      ).ok
    ).toBe(false);
    expect(
      validateProviderWebhookUrl("MICROSOFT_TEAMS", "https://www.office.com/").ok
    ).toBe(false);
  });

  it("accepts Telegram sendMessage bot URLs", () => {
    expect(
      validateProviderWebhookUrl(
        "TELEGRAM",
        "https://api.telegram.org/bot123:ABC/sendMessage"
      )
    ).toEqual({ ok: true });
  });
});

describe("channel payload builders", () => {
  it("builds Slack mrkdwn blocks", () => {
    const parsed = JSON.parse(buildSlackIncomingWebhookBody(sample)) as {
      text: string;
      blocks: unknown[];
    };
    expect(parsed.text).toContain("Error spike");
    expect(parsed.blocks).toHaveLength(1);
  });

  it("builds Discord embeds with rule field", () => {
    const parsed = JSON.parse(buildDiscordWebhookBody(sample)) as {
      embeds: Array<{ title: string; fields: Array<{ name: string }> }>;
    };
    expect(parsed.embeds[0]?.title).toBe("Error spike detected");
    expect(parsed.embeds[0]?.fields[0]?.name).toBe("Rule");
  });

  it("builds Teams MessageCard", () => {
    const parsed = JSON.parse(buildMicrosoftTeamsWebhookBody(sample)) as {
      "@type": string;
      title: string;
    };
    expect(parsed["@type"]).toBe("MessageCard");
    expect(parsed.title).toBe("Error spike detected");
  });

  it("builds Telegram HTML sendMessage body", () => {
    const parsed = JSON.parse(
      buildTelegramSendMessageBody(sample, { chatId: "-1001" })
    ) as { chat_id: string; parse_mode: string; text: string };
    expect(parsed.chat_id).toBe("-1001");
    expect(parsed.parse_mode).toBe("HTML");
    expect(parsed.text).toContain("<b>Error spike detected</b>");
  });

  it("requires Telegram chat id for TELEGRAM delivery body", () => {
    const result = buildAlertDeliveryBody("TELEGRAM", sample, "{}");
    expect(result.ok).toBe(false);
  });

  it("returns Slack body via buildAlertDeliveryBody", () => {
    const result = buildAlertDeliveryBody("SLACK", sample, '{"generic":true}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.parse(result.body).blocks).toBeTruthy();
    }
  });
});

describe("parseTelegramWebhookConfig", () => {
  it("accepts numeric and @username chat ids", () => {
    expect(parseTelegramWebhookConfig({ chatId: -100123 })).toEqual({
      ok: true,
      config: { chatId: "-100123" },
    });
    expect(parseTelegramWebhookConfig({ chatId: "@ops" }).ok).toBe(true);
  });

  it("rejects empty chat ids", () => {
    expect(parseTelegramWebhookConfig({ chatId: "  " }).ok).toBe(false);
  });
});
