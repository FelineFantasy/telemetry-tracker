/** Lightweight browser/OS hints for session ingest (no UA parser dependency). */

export type DeviceContext = {
  device_browser?: string;
  device_os?: string;
  country?: string;
};

function parseBrowser(ua: string): string | undefined {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return "Opera";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  return undefined;
}

function parseOs(ua: string): string | undefined {
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/(iPhone|iPad|iPod)/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  return undefined;
}

function localeCountry(): string | undefined {
  if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat !== "function") {
    return undefined;
  }
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const match = locale.match(/[-_]([A-Za-z]{2})\b/);
    if (!match) return undefined;
    return match[1].toUpperCase();
  } catch {
    return undefined;
  }
}

/** Best-effort device + country from the runtime environment. */
export function readDeviceContext(): DeviceContext {
  const out: DeviceContext = {};
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    const ua = navigator.userAgent;
    out.device_browser = parseBrowser(ua);
    out.device_os = parseOs(ua);
  }
  out.country = localeCountry();
  return out;
}
