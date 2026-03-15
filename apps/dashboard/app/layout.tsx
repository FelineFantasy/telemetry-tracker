import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Telemetry Tracker",
  description: "Internal telemetry dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 16 }}>
        <nav style={{ marginBottom: 24, borderBottom: "1px solid #ccc", paddingBottom: 8 }}>
          <a href="/" style={{ marginRight: 16 }}>Overview</a>
          <a href="/errors" style={{ marginRight: 16 }}>Errors</a>
          <a href="/events">Events</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
