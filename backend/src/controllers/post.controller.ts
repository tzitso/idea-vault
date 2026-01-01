import { Context } from "hono";
import { PostService } from "@/services/post.service";
import { ApiResponse } from "@/types/index.types";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  content: z.string().min(1, "Content is required").max(10000, "Content too long"),
  unlockAt: z.string().datetime("Invalid datetime format"),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

const getPostsQuerySchema = z.object({
  status: z.enum(["locked", "public", "archived"]).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional(),
});

export type CreatePostBody = z.infer<typeof createPostSchema>;
export type GetPostsQuery = z.infer<typeof getPostsQuerySchema>;

export class PostController {
  static async getAll(c: Context): Promise<Response> {
    const query = c.req.query();
    const validated = getPostsQuerySchema.parse(query);
    
    // Get user from context if authenticated (optional)
    const user = c.get("user") as { id: string } | undefined;

    const posts = await PostService.getAll({
      status: validated.status,
      limit: validated.limit || 20,
      offset: validated.offset || 0,
      userId: user?.id,
    });

    return c.json<ApiResponse>({
      success: true,
      data: posts,
    });
  }

  static async create(c: Context): Promise<Response> {
    const user = c.get("user");
    const body = await c.req.json();
    const validated = createPostSchema.parse(body);

    const post = await PostService.create({
      authorId: user.id,
      title: validated.title,
      content: validated.content,
      unlockAt: new Date(validated.unlockAt),
      tags: validated.tags,
    });

    return c.json<ApiResponse>(
      {
        success: true,
        data: post,
      },
      201
    );
  }

  static async watch(c: Context): Promise<Response> {
    const user = c.get("user");
    const postId = c.req.param("id");

    await PostService.watchPost(user.id, postId);

    return c.json<ApiResponse>({
      success: true,
      data: { message: "Post added to watchlist" },
    });
  }

  static async unwatch(c: Context): Promise<Response> {
    const user = c.get("user");
    const postId = c.req.param("id");

    await PostService.unwatchPost(user.id, postId);

    return c.json<ApiResponse>({
      success: true,
      data: { message: "Post removed from watchlist" },
    });
  }

  static async getById(c: Context): Promise<Response> {
    const postId = c.req.param("id");
    const user = c.get("user") as { id: string } | undefined;

    const post = await PostService.getById(postId, user?.id);

    return c.json<ApiResponse>({
      success: true,
      data: post,
    });
  }

  static async like(c: Context): Promise<Response> {
    const user = c.get("user");
    const postId = c.req.param("id");

    await PostService.likePost(user.id, postId);

    return c.json<ApiResponse>({
      success: true,
      data: { message: "Post liked" },
    });
  }

  static async unlike(c: Context): Promise<Response> {
    const user = c.get("user");
    const postId = c.req.param("id");

    await PostService.unlikePost(user.id, postId);

    return c.json<ApiResponse>({
      success: true,
      data: { message: "Post unliked" },
    });
  }
}