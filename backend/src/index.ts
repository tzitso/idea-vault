import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "@/lib/auth";
import posts from "@/routes/post.routes";
import { errorHandler } from "@/middleware/error-handler.middleware";

const app = new Hono();

app.onError(errorHandler);

app.use("/*", cors());

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

app.route("/api/posts", posts);

app.get("/health", (c) => c.json({ status: "ok" }));

export default {
  port: 3000,
  fetch: app.fetch,
};