import { LegalMarketingShell } from "@/app/components/legal/LegalMarketingShell";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LegalMarketingShell>{children}</LegalMarketingShell>;
}
