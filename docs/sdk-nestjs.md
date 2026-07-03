# NestJS

NestJS backend integration via `@telemetry-tracker/node`. Initializes global Node error handlers and optional HTTP request middleware. For non-Nest Node servers, see [sdk-node.md](sdk-node.md).

## Install

```bash
pnpm add @telemetry-tracker/node
```

## Bootstrap

Call `init()` in `main.ts` before `NestFactory.create`:

```ts
import { NestFactory } from "@nestjs/core";
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

bootstrap();
```

## Request middleware

Wrap the generic Node middleware in a Nest `NestMiddleware`:

```ts
// telemetry.middleware.ts
import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { middleware } from "@telemetry-tracker/node";

const trackRequest = middleware({ trackRequestBody: false });

@Injectable()
export class TelemetryMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    trackRequest(req, res, next);
  }
}
```

Register in `AppModule`:

```ts
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { TelemetryMiddleware } from "./telemetry.middleware";

@Module({ /* … */ })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TelemetryMiddleware).forRoutes("*");
  }
}
```

## API

| Export | Description |
|--------|-------------|
| `init(config)` | Initialize SDK and install global error handlers. |
| `identify(userId)` | Attach user id to subsequent payloads. |
| `trackEvent(name, properties?)` | Send a named event. |
| `trackError(error, context?)` | Report an error (e.g. in catch blocks). |
| `middleware(opts?)` | HTTP `$request` tracking middleware. |

Config extends [telemetry-core](sdk-core.md#initconfig).

## Hosted cloud

Set `TELEMETRY_INGEST_URL=https://api.telemetry-tracker.com` and `TELEMETRY_API_KEY` from the dashboard. See `/docs/hosted-cloud`.
