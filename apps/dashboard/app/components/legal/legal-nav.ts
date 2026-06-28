export const privacyAnchors = [
  { id: "overview", label: "Overview" },
  { id: "data-collected", label: "Data we help you collect" },
  { id: "account-data", label: "Account data" },
  { id: "retention", label: "Retention and deletion" },
  { id: "contact", label: "Contact" },
];

export const termsAnchors = [
  { id: "agreement", label: "Agreement" },
  { id: "service", label: "The service" },
  { id: "responsibilities", label: "Your responsibilities" },
  { id: "disclaimer", label: "Disclaimer" },
  { id: "contact", label: "Contact" },
];

export const contactAnchors = [
  { id: "overview", label: "Get in touch" },
  { id: "email", label: "Email" },
  { id: "community", label: "Community & docs" },
  { id: "security", label: "Security" },
];

export function legalAnchorsForPath(pathname: string) {
  if (pathname === "/privacy" || pathname === "/privacy/") return privacyAnchors;
  if (pathname === "/terms" || pathname === "/terms/") return termsAnchors;
  if (pathname === "/contact" || pathname === "/contact/") return contactAnchors;
  return [];
}
