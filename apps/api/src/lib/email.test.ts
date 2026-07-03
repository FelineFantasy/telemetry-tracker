import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "./email.js";

describe("isTransactionalEmailConfigured", () => {
  const prevKey = process.env.RESEND_API_KEY;
  const prevFrom = process.env.TELEMETRY_EMAIL_FROM;

  afterEach(() => {
    if (prevKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevKey;
    if (prevFrom === undefined) delete process.env.TELEMETRY_EMAIL_FROM;
    else process.env.TELEMETRY_EMAIL_FROM = prevFrom;
  });

  it("returns false when either env var is missing", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.TELEMETRY_EMAIL_FROM;
    expect(isTransactionalEmailConfigured()).toBe(false);

    process.env.RESEND_API_KEY = "re_test";
    expect(isTransactionalEmailConfigured()).toBe(false);

    delete process.env.RESEND_API_KEY;
    process.env.TELEMETRY_EMAIL_FROM = "Telemetry <noreply@example.com>";
    expect(isTransactionalEmailConfigured()).toBe(false);
  });

  it("returns true when both env vars are set", () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.TELEMETRY_EMAIL_FROM = "Telemetry <noreply@example.com>";
    expect(isTransactionalEmailConfigured()).toBe(true);
  });
});

describe("sendTransactionalEmail", () => {
  const prevKey = process.env.RESEND_API_KEY;
  const prevFrom = process.env.TELEMETRY_EMAIL_FROM;
  const prevNodeEnv = process.env.NODE_ENV;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (prevKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevKey;
    if (prevFrom === undefined) delete process.env.TELEMETRY_EMAIL_FROM;
    else process.env.TELEMETRY_EMAIL_FROM = prevFrom;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
  });

  it("dev-logs and skips Resend when not configured in development", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.TELEMETRY_EMAIL_FROM;
    process.env.NODE_ENV = "development";
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const result = await sendTransactionalEmail({
      to: "user@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result).toEqual({ sent: false, devLogged: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      "[email:dev]",
      "user@example.com",
      "Test",
      "<p>Hello</p>"
    );
    logSpy.mockRestore();
  });

  it("no-ops silently in production when not configured", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.TELEMETRY_EMAIL_FROM;
    process.env.NODE_ENV = "production";

    const result = await sendTransactionalEmail({
      to: "user@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result).toEqual({ sent: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to Resend when configured", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.TELEMETRY_EMAIL_FROM = "Telemetry <noreply@example.com>";
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => "",
    });

    const result = await sendTransactionalEmail({
      to: "user@example.com",
      subject: "Reset password",
      html: "<p>Link</p>",
      replyTo: "support@example.com",
    });

    expect(result).toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test",
        }),
      })
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      from: string;
      reply_to?: string;
    };
    expect(body.from).toBe("Telemetry <noreply@example.com>");
    expect(body.reply_to).toBe("support@example.com");
  });

  it("returns Resend error details on failure", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.TELEMETRY_EMAIL_FROM = "Telemetry <noreply@example.com>";
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: "Domain not verified" }),
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await sendTransactionalEmail({
      to: "user@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result).toEqual({
      sent: false,
      status: 403,
      error: "Domain not verified",
    });
    warnSpy.mockRestore();
  });
});
