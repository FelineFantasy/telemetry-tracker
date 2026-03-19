import { CodeBlock } from "../components/CodeBlock";

export const metadata = {
  title: "React Native — Docs — Telemetry Tracker",
  description: "Integrate Telemetry Tracker with React Native",
};

export default function DocsReactNativePage() {
  return (
    <>
      <h1>React Native</h1>
      <p>
        Use the <code>@tacko/telemetry-react-native</code> package for React Native
        apps. It starts a session on init, registers a global error handler with
        ErrorUtils, and re-exports <code>trackEvent</code>, <code>trackError</code>,{" "}
        <code>screen</code>, and <code>identify</code>. Sessions and events include anonymous id and SDK version (from core).
      </p>

      <h2>Install</h2>
      <CodeBlock code={`pnpm add @tacko/telemetry-react-native
# or
npm install @tacko/telemetry-react-native`} />

      <h2>Setup</h2>
      <p>Call <code>init()</code> once at app startup (e.g. in your root component or entry file):</p>
      <CodeBlock
        code={`import { init } from "@tacko/telemetry-react-native";

init({
  ingestUrl: "https://your-api.example.com",
  app: "my-rn-app",
  platform: "react-native",
});`}
      />

      <h2>Session tracking</h2>
      <p>
        The package automatically creates a session when you call{" "}
        <code>init()</code> and sends it to <code>POST /ingest/session</code>.
        You can call <code>endSession()</code> when the app goes to background
        if you want to close the session (e.g. in an app state listener).
      </p>

      <h2>Screen tracking</h2>
      <p>
        Call <code>screen(screenName)</code> when the user navigates to a
        screen (e.g. in your navigator’s screen listener or in a
        useFocusEffect).
      </p>
      <CodeBlock
        code={`import { screen } from "@tacko/telemetry-react-native";

screen("Home");
screen("Profile");`}
      />

      <h2>Events and errors</h2>
      <CodeBlock
        code={`import { trackEvent, trackError, identify } from "@tacko/telemetry-react-native";

trackEvent("button_press", { screen: "Home", id: "submit" });
trackError(new Error("Something broke"), { screen: "Checkout" });
identify(user.id);`}
      />

      <h2>Global error handler</h2>
      <p>
        After <code>init()</code>, the package sets{" "}
        <code>ErrorUtils.setGlobalHandler</code> so unhandled JavaScript errors
        are sent to the ingest API. The previous handler is not re-invoked (to avoid duplicate reports).
      </p>
    </>
  );
}
