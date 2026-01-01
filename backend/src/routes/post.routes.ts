import { Hono } from "hono";
import { PostController } from "@/controllers/post.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { rateLimit } from "@/middleware/rate-limit.middleware";
import { cacheMiddleware } from "@/middleware/cache.middleware";
import { errorHandler } from "@/middleware/error-handler.middleware";

const posts = new Hono();

posts.onError(errorHandler);

// GET /api/posts - Get all posts
posts.get(
  "/",
  cacheMiddleware({ ttl: 60000 }),
  PostController.getAll
);

// POST /api/posts - Create a new post
posts.post(
  "/",
  authMiddleware,
  rateLimit({ windowMs: 60000, max: 10 }),
  PostController.create
);

// GET /api/posts/:id - Get single post (with view count increment)
posts.get(
  "/:id",
  PostController.getById
);

// POST /api/posts/:id/watch - Add to watchlist
posts.post(
  "/:id/watch",
  authMiddleware,
  PostController.watch
);

// DELETE /api/posts/:id/watch - Remove from watchlist
posts.delete(
  "/:id/watch",
  authMiddleware,
  PostController.unwatch
);

// POST /api/posts/:id/like - Like a post
posts.post(
  "/:id/like",
  authMiddleware,
  PostController.like
);

// DELETE /api/posts/:id/like - Unlike a post
posts.delete(
  "/:id/like",
  authMiddleware,
  PostController.unlike
);

export default posts;