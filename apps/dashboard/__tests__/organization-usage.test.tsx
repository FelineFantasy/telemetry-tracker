import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrganizationUsageCard } from "@/app/dashboard/settings/organization/OrganizationUsageCard";

describe("OrganizationUsageCard", () => {
  it("shows plan tier and usage percent", () => {
    render(
      <OrganizationUsageCard
        usage={{
          planTier: "FREE",
          monthlyIngestUsed: 50_000,
          monthlyIngestLimit: 250_000,
          percentUsed: 20,
          quotaExceeded: false,
          nearQuota: false,
          retentionDays: 14,
        }}
      />
    );
    expect(screen.getByText(/FREE/)).toBeTruthy();
    expect(screen.getByText(/20%/)).toBeTruthy();
    expect(screen.getByText(/14 days/)).toBeTruthy();
  });
});
