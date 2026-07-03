import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/app/components/docs/CodeBlock";
import { DocsArticle } from "@/app/components/docs/DocsArticle";

export const metadata: Metadata = {
  title: "NestJS — Docs — Telemetry Tracker",
  description: "Integrate Telemetry Tracker with NestJS APIs",
};

export default function DocsNestJsPage() {
  return (
    <DocsArticle
      title="NestJS"
      lede={
        <p>
          Use <code>@telemetry-tracker/node</code> in NestJS backends. Call <code>init()</code> in{" "}
          <code>main.ts</code> before <code>NestFactory.create</code> so global{" "}
          <code>uncaughtException</code> and <code>unhandledRejection</code> handlers are installed.
          Optional Nest middleware tracks HTTP requests. For plain Express or Fastify without Nest,
          see the{" "}
          <Link href="/docs/node" className="text-brand hover:underline">
            Node.js guide
          </Link>
          .
        </p>
      }
    >
      <h2>Install</h2>
      <CodeBlock
        code={`pnpm add @telemetry-tracker/node
# or
npm install @telemetry-tracker/node`}
      />

      <h2>Initialize in main.ts</h2>
      <p>
        Call <code>init()</code> as early as possible — before creating the Nest application:
      </p>
      <CodeBlock
        code={`import { NestFactory } from "@nestjs/core";
import { init } from "@telemetry-tracker/node";
import { AppModule } from "./app.module";

async function bootstrap() {
  init({
    ingestUrl: process.env.TELEMETRY_INGEST_URL ?? "https://your-api.example.com",
    app: process.env.TELEMETRY_APP ?? "my-nest-api",
    apiKey: process.env.TELEMETRY_API_KEY,
    platform: "node",
    environment: process.env.NODE_ENV,
  });

  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();`}
      />

      <h2>Request middleware</h2>
      <p>
        Wrap the generic <code>middleware()</code> from <code>@telemetry-tracker/node</code> in a
        Nest middleware class to emit <code>$request</code> events (method, url, duration):
      </p>
      <CodeBlock
        code={`// telemetry.middleware.ts
import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { middleware } from "@telemetry-tracker/node";

const trackRequest = middleware({ trackRequestBody: false });

@Injectable()
export class TelemetryMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    trackRequest(req, res, next);
  }
}`}
      />

      <CodeBlock
        code={`// app.module.ts
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { TelemetryMiddleware } from "./telemetry.middleware";

@Module({ /* imports, controllers, providers */ })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TelemetryMiddleware).forRoutes("*");
  }
}`}
      />

      <h2>Handled errors</h2>
      <p>
        Global process handlers cover uncaught failures. For expected errors in services or
        controllers, call <code>trackError</code> before rethrowing or map to an HTTP exception:
      </p>
      <CodeBlock
        code={`import { trackError } from "@telemetry-tracker/node";

try {
  await this.ordersService.charge(id);
} catch (err) {
  trackError(err, { orderId: id, handler: "OrdersController.charge" });
  throw err;
}`}
      />

      <h2>Per-request user context</h2>
      <p>
        After authentication, call <code>identify(userId)</code> in a guard or interceptor so
        errors and events include the current user:
      </p>
      <CodeBlock
        code={`import { identify } from "@telemetry-tracker/node";

// e.g. in an AuthGuard or interceptor after validating JWT
identify(req.user.id);`}
      />
    </DocsArticle>
  );
}
