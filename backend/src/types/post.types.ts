import { createPostSchema, getPostsQuerySchema } from "@/schema/post.schema";
import { z } from "zod";

export interface CreatePostInput {
  authorId: string;
  title: string;
  content: string;
  unlockAt: Date;
  tags?: string[];
}

export interface GetAllPostsInput {
  status?: "locked" | "public" | "archived";
  limit: number;
  offset: number;
  userId?: string; // Added
}

export interface PostWithAuthor {
  id: string;
  title: string | null;
  content: string | null;
  status: "locked" | "public" | "archived";
  unlockAt: Date;
  unlockedAt: Date | null;
  viewCount: number;
  watchCount: number;
  likeCount: number; // Added
  isWatching?: boolean;
  isLiked?: boolean; // Added
  createdAt: Date;
  isLocked: boolean;
  author: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  };
  tags: Array<{
    id: string;
    name: string;
  }>;
}
  

export type CreatePostBody = z.infer<typeof createPostSchema>;
export type GetPostsQuery = z.infer<typeof getPostsQuerySchema>;