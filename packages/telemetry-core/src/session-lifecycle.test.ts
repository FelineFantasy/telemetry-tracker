import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("browser session lifecycle", () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
  let visibilityState: DocumentVisibilityState = "visible";
  const listeners = new Map<string, Set<EventListener>>();

  beforeEach(async () => {
    vi.resetModules();
    fetchMock.mockClear();
    visibilityState = "visible";
    listeners.clear();

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {},
    });
    vi.stubGlobal("document", {
      get visibilityState() {
        return visibilityState;
      },
      addEventListener(type: string, listener: EventListener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(listener);
      },
    });
    vi.stubGlobal("window", {
      addEventListener(type: string, listener: EventListener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(listener);
      },
    });
    vi.stubGlobal("setInterval", () => 0 as unknown as ReturnType<typeof setInterval>);

    const { init, getSessionId, trackEvent } = await import("./index.js");
    init({
      ingestUrl: "http://localhost:3001",
      app: "test-app",
      apiKey: "tt_live_pub_secret",
      batchInterval: 0,
      environment: "test",
    });

    return { getSessionId, trackEvent };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fire(type: string): void {
    for (const listener of listeners.get(type) ?? []) {
      listener(new Event(type));
    }
  }

  it("starts a new session after tab hide when tab becomes visible again", async () => {
    const { getSessionId, trackEvent } = await import("./index.js");
    const firstId = getSessionId();
    expect(firstId).toBeTruthy();

    visibilityState = "hidden";
    fire("visibilitychange");
    expect(getSessionId()).toBeNull();

    visibilityState = "visible";
    fire("visibilitychange");
    const secondId = getSessionId();
    expect(secondId).toBeTruthy();
    expect(secondId).not.toBe(firstId);

    trackEvent("after_return");
    await new Promise((r) => setTimeout(r, 10));

    const eventCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/ingest/event")
    );
    expect(eventCall).toBeTruthy();
    const body = JSON.parse((eventCall![1] as RequestInit).body as string);
    expect(body.session_id).toBe(secondId);
  });
});
