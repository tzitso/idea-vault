import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  content: z.string().min(1, "Content is required").max(10000, "Content too long"),
  unlockAt: z.string().datetime("Invalid datetime format"),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const getPostsQuerySchema = z.object({
  status: z.enum(["locked", "public", "archived"]).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional(),
});