import { Context, Next } from "hono";

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

interface CacheOptions {
  ttl: number; // Time to live in milliseconds
}

export function cacheMiddleware(options: CacheOptions) {
  const { ttl } = options;

  return async (c: Context, next: Next): Promise<void> => {
    const key = c.req.url;
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      return c.json(cached.data);
    }

    await next();

    const response = await c.res.clone().json();
    cache.set(key, {
      data: response,
      expiresAt: now + ttl,
    });
  };
}