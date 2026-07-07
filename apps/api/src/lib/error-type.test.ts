import { describe, expect, it } from "vitest";
import { ERROR_TYPES, parseErrorTypeFromMessage } from "./error-type.js";

describe("parseErrorTypeFromMessage", () => {
  it("classifies known message prefixes", () => {
    expect(parseErrorTypeFromMessage("TypeError: Cannot read property 'x'")).toBe("TypeError");
    expect(parseErrorTypeFromMessage("ReferenceError: foo is not defined")).toBe("ReferenceError");
    expect(parseErrorTypeFromMessage("Network Error: timeout")).toBe("Network Error");
    expect(parseErrorTypeFromMessage("Validation Error: email invalid")).toBe("Validation Error");
  });

  it("is case-insensitive on prefixes", () => {
    expect(parseErrorTypeFromMessage("typeerror: bad")).toBe("TypeError");
    expect(parseErrorTypeFromMessage("network error")).toBe("Network Error");
  });

  it("falls back to Other for unrecognized messages", () => {
    expect(parseErrorTypeFromMessage("Something went wrong")).toBe("Other");
    expect(parseErrorTypeFromMessage("")).toBe("Other");
  });

  it("trims leading whitespace before prefix checks", () => {
    expect(parseErrorTypeFromMessage("  TypeError: bad")).toBe("TypeError");
    expect(parseErrorTypeFromMessage("\n ReferenceError: x")).toBe("ReferenceError");
  });

  it("exports a stable taxonomy order", () => {
    expect(ERROR_TYPES).toEqual([
      "TypeError",
      "ReferenceError",
      "Network Error",
      "Validation Error",
      "Other",
    ]);
  });
});
