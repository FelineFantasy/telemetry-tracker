import { CodeBlock } from "../components/CodeBlock";

export const metadata = {
  title: "Next.js — Docs — Telemetry Tracker",
  description: "Integrate Telemetry Tracker with Next.js",
};

export default function DocsNextJsPage() {
  return (
    <>
      <h1>Next.js</h1>
      <p>
        Use the <code>@tacko/telemetry-next</code> package for Next.js apps. It
        provides a provider, error boundary, and a hook to track page views.
      </p>

      <h2>Install</h2>
      <CodeBlock code={`pnpm add @tacko/telemetry-next
# or
npm install @tacko/telemetry-next`} />

      <h2>Setup</h2>
      <p>
        Wrap your app with <code>TelemetryProvider</code> and pass the config.
        Call <code>useTrackPage(pathname)</code> in your root layout so each
        route change sends a screen event.
      </p>
      <CodeBlock
        code={`// app/layout.tsx
import { TelemetryProvider, useTrackPage } from "@tacko/telemetry-next";

function TrackPageView({ pathname }: { pathname: string }) {
  useTrackPage(pathname);
  return null;
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <TelemetryProvider
          config={{
            ingestUrl: process.env.NEXT_PUBLIC_TELEMETRY_INGEST_URL ?? "",
            app: process.env.NEXT_PUBLIC_TELEMETRY_APP ?? "my-next-app",
          }}
        >
          <TrackPageView pathname={/* get pathname from usePathname() */} />
          {children}
        </TelemetryProvider>
      </body>
    </html>
  );
}`}
      />

      <p>
        For the pathname you need a client component that uses{" "}
        <code>usePathname()</code> from <code>next/navigation</code> and passes
        it to <code>useTrackPage(pathname)</code>.
      </p>

      <h2>Error boundary</h2>
      <p>
        Wrap parts of your tree with <code>TelemetryErrorBoundary</code> to
        automatically send React errors to the ingest API.
      </p>
      <CodeBlock
        code={`import { TelemetryErrorBoundary } from "@tacko/telemetry-next";

<TelemetryErrorBoundary fallback={<div>Something went wrong</div>}>
  <YourComponent />
</TelemetryErrorBoundary>`}
      />

      <h2>Custom events and identify</h2>
      <CodeBlock
        code={`import { trackEvent, identify } from "@tacko/telemetry-next";

trackEvent("signup_clicked", { source: "hero" });
identify(user.id);  // after login
identify(null);     // on logout`}
      />
    </>
  );
}
