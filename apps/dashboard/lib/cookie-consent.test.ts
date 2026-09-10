import { describe, expect, it } from "vitest";
import {
  readCookieConsentChoiceFromCookieHeader,
  COOKIE_CONSENT_STORAGE_KEY,
} from "./cookie-consent";

describe("readCookieConsentChoiceFromCookieHeader", () => {
  it("reads the consent cookie among other cookies", () => {
    expect(
      readCookieConsentChoiceFromCookieHeader(
        `theme=dark; ${COOKIE_CONSENT_STORAGE_KEY}=accepted; other=1`
      )
    ).toBe("accepted");
  });

  it("returns rejected", () => {
    expect(
      readCookieConsentChoiceFromCookieHeader(`${COOKIE_CONSENT_STORAGE_KEY}=rejected`)
    ).toBe("rejected");
  });

  it("returns null for missing or invalid values", () => {
    expect(readCookieConsentChoiceFromCookieHeader("")).toBeNull();
    expect(readCookieConsentChoiceFromCookieHeader("foo=bar")).toBeNull();
    expect(
      readCookieConsentChoiceFromCookieHeader(`${COOKIE_CONSENT_STORAGE_KEY}=maybe`)
    ).toBeNull();
  });
});
