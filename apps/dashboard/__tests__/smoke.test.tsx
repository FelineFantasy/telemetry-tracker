import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("dashboard test harness", () => {
  it("renders with Testing Library", () => {
    render(<div data-testid="smoke">ok</div>);
    expect(screen.getByTestId("smoke").textContent).toBe("ok");
  });
});
