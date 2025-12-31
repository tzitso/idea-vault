import { Context, Next } from "hono";
import { auth } from "@/lib/auth";
import { HttpError } from "@/middleware/error-handler.middleware";
import { AuthUser } from "@/types/index.types";

export async function authMiddleware(c: Context, next: Next): Promise<void> {
  // Try to get session from Better Auth
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  console.log("Session result:", session); // Debug log

  if (!session || !session.user) {
    throw new HttpError("Unauthorized", 401);
  }

  const authUser: AuthUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };

  c.set("user", authUser);
  await next();
}