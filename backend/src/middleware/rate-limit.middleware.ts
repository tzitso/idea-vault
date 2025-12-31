import { Context, Next } from "hono";
import { HttpError } from "@/middleware/error-handler.middleware";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max } = options;

  return async (c: Context, next: Next): Promise<void> => {
    const key = c.req.header("x-forwarded-for") || "anonymous";
    const now = Date.now();

    if (!store[key] || store[key].resetAt < now) {
      store[key] = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    store[key].count++;

    if (store[key].count > max) {
      throw new HttpError("Too many requests", 429);
    }

    await next();
  };
}
