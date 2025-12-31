import { Hono } from "hono";
import { PostController } from "@/controllers/post.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { rateLimit } from "@/middleware/rate-limit.middleware";
import { cacheMiddleware } from "@/middleware/cache.middleware";
import { errorHandler } from "@/middleware/error-handler.middleware";

const posts = new Hono();

posts.onError(errorHandler);

// GET /api/posts - Get all posts (cached for 60 seconds)
posts.get(
  "/",
  cacheMiddleware({ ttl: 60000 }),
  PostController.getAll
);

// POST /api/posts - Create a new post (auth + rate limit: 10 per minute)
posts.post(
  "/",
  authMiddleware,
  rateLimit({ windowMs: 60000, max: 10 }),
  PostController.create
);

// POST /api/posts/:id/watch - Add post to watchlist (auth required)
posts.post(
  "/:id/watch",
  authMiddleware,
  PostController.watch
);

// DELETE /api/posts/:id/watch - Remove post from watchlist (auth required)
posts.delete(
  "/:id/watch",
  authMiddleware,
  PostController.unwatch
);

export default posts;