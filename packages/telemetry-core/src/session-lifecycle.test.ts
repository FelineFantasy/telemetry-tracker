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

    const { init } = await import("./index.js");
    init({
      ingestUrl: "http://localhost:3001",
      app: "test-app",
      apiKey: "tt_live_pub_secret",
      batchInterval: 0,
      environment: "test",
      webVitals: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fire(type: string, init?: { persisted?: boolean }): void {
    const event = new Event(type);
    if (init?.persisted != null) {
      Object.defineProperty(event, "persisted", { value: init.persisted });
    }
    for (const listener of listeners.get(type) ?? []) {
      listener(event);
    }
  }

  it("keeps the same session id across tab hide/show", async () => {
    const { getSessionId } = await import("./index.js");
    const firstId = getSessionId();
    expect(firstId).toBeTruthy();

    visibilityState = "hidden";
    fire("visibilitychange");
    expect(getSessionId()).toBe(firstId);

    visibilityState = "visible";
    fire("visibilitychange");
    expect(getSessionId()).toBe(firstId);
  });

  it("closes the session on pagehide and starts a new one on pageshow", async () => {
    const { getSessionId } = await import("./index.js");
    const firstId = getSessionId();
    expect(firstId).toBeTruthy();

    fire("pagehide", { persisted: false });
    expect(getSessionId()).toBeNull();

    fire("pageshow", { persisted: false });
    const secondId = getSessionId();
    expect(secondId).toBeTruthy();
    expect(secondId).not.toBe(firstId);
  });

  it("keeps the session when pagehide is for back-forward cache", async () => {
    const { getSessionId } = await import("./index.js");
    const firstId = getSessionId();
    expect(firstId).toBeTruthy();

    fire("pagehide", { persisted: true });
    expect(getSessionId()).toBe(firstId);

    fire("pageshow", { persisted: true });
    expect(getSessionId()).toBe(firstId);
  });

  it("ends the prior session when init is called again", async () => {
    const { init, getSessionId } = await import("./index.js");
    const firstId = getSessionId();
    expect(firstId).toBeTruthy();

    init({
      ingestUrl: "http://localhost:3001",
      app: "test-app",
      apiKey: "tt_live_pub_secret",
      batchInterval: 0,
      environment: "test",
      webVitals: false,
    });

    const secondId = getSessionId();
    expect(secondId).toBeTruthy();
    expect(secondId).not.toBe(firstId);

    const sessionPosts = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/ingest/session")
    );
    const endedFirst = sessionPosts.some(([, opts]) => {
      const body = JSON.parse((opts as RequestInit).body as string);
      return body.session_id === firstId && body.ended_at != null;
    });
    expect(endedFirst).toBe(true);
  });
});

describe("batched event flush on page lifecycle", () => {
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

    const { init } = await import("./index.js");
    init({
      ingestUrl: "http://localhost:3001",
      app: "test-app",
      apiKey: "tt_live_pub_secret",
      batchInterval: 60_000,
      batchSize: 100,
      environment: "test",
      webVitals: false,
    });
    fetchMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fire(type: string, init?: { persisted?: boolean }): void {
    const event = new Event(type);
    if (init?.persisted != null) {
      Object.defineProperty(event, "persisted", { value: init.persisted });
    }
    for (const listener of listeners.get(type) ?? []) {
      listener(event);
    }
  }

  function latestBatchBody(): { events: { name: string }[] } {
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes("/ingest/batch"));
    expect(call).toBeDefined();
    return JSON.parse((call![1] as RequestInit).body as string);
  }

  it("flushes batched events on pagehide with keepalive", async () => {
    const { trackEvent } = await import("./index.js");
    trackEvent("$web_vital", { metric: "CLS", value: 0.05 });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/ingest/batch"))).toBe(
      false
    );

    fire("pagehide", { persisted: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/ingest/batch",
      expect.objectContaining({ keepalive: true })
    );
    expect(latestBatchBody().events[0].name).toBe("$web_vital");
  });

  it("flushes batched events when the tab becomes hidden", async () => {
    const { trackEvent } = await import("./index.js");
    trackEvent("$web_vital", { metric: "LCP", value: 1200 });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/ingest/batch"))).toBe(
      false
    );

    visibilityState = "hidden";
    fire("visibilitychange");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/ingest/batch",
      expect.objectContaining({ keepalive: true })
    );
    expect(latestBatchBody().events[0].name).toBe("$web_vital");
  });
});
