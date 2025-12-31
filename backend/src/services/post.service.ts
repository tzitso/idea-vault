import { db } from "@/db";
import { post, tag, postTag, user, watcher, InsertPost } from "@/db/schema";
import { eq, desc, inArray, sql, and } from "drizzle-orm";
import { HttpError } from "@/middleware/error-handler.middleware";
import { GetAllPostsInput, PostWithAuthor, CreatePostInput } from "@/types/post.types";


export class PostService {
  static async getAll(input: GetAllPostsInput): Promise<PostWithAuthor[]> {
    const { status, limit, offset, userId } = input;

    let query = db
      .select({
        id: post.id,
        title: post.title,
        content: post.content,
        status: post.status,
        unlockAt: post.unlockAt,
        unlockedAt: post.unlockedAt,
        viewCount: post.viewCount,
        createdAt: post.createdAt,
        author: {
          id: user.id,
          name: user.name,
          username: user.username,
          image: user.image,
        },
      })
      .from(post)
      .innerJoin(user, eq(post.authorId, user.id))
      .orderBy(desc(post.createdAt))
      .limit(limit)
      .offset(offset);

    if (status) {
      query = query.where(eq(post.status, status)) as typeof query;
    }

    const posts = await query;

    if (posts.length === 0) {
      return [];
    }

    const postIds = posts.map((p) => p.id);
    
    // Fetch tags
    const tagsData = await db
      .select({
        postId: postTag.postId,
        tagId: tag.id,
        tagName: tag.name,
      })
      .from(postTag)
      .innerJoin(tag, eq(postTag.tagId, tag.id))
      .where(inArray(postTag.postId, postIds));

    // Fetch watch counts
    const watchCounts = await db
      .select({
        postId: watcher.postId,
        count: sql<number>`count(*)::int`,
      })
      .from(watcher)
      .where(inArray(watcher.postId, postIds))
      .groupBy(watcher.postId);

    // Fetch user's watch status if userId provided
    let userWatches: Set<string> = new Set();
    if (userId) {
      const watches = await db
        .select({ postId: watcher.postId })
        .from(watcher)
        .where(
          and(
            eq(watcher.userId, userId),
            inArray(watcher.postId, postIds)
          )
        );
      userWatches = new Set(watches.map((w) => w.postId));
    }

    // Group tags by post
    const tagsByPost = new Map<string, Array<{ id: string; name: string }>>();
    for (const tagData of tagsData) {
      if (!tagsByPost.has(tagData.postId)) {
        tagsByPost.set(tagData.postId, []);
      }
      tagsByPost.get(tagData.postId)!.push({
        id: tagData.tagId,
        name: tagData.tagName,
      });
    }

    // Map watch counts
    const watchCountByPost = new Map<string, number>();
    for (const wc of watchCounts) {
      watchCountByPost.set(wc.postId, wc.count);
    }

    return posts.map((p) => ({
      ...p,
      id: p.id,
      status: p.status as "locked" | "public" | "archived",
      title: p.status === "locked" ? null : p.title,
      content: p.status === "locked" ? null : p.content,
      isLocked: p.status === "locked",
      watchCount: watchCountByPost.get(p.id) || 0,
      isWatching: userId ? userWatches.has(p.id) : undefined,
      tags: tagsByPost.get(p.id) || [],
    }));
  }

  static async watchPost(userId: string, postId: string): Promise<void> {
    // Check if post exists and is locked
    const [postData] = await db
      .select({ status: post.status })
      .from(post)
      .where(eq(post.id, postId))
      .limit(1);

    if (!postData) {
      throw new HttpError("Post not found", 404);
    }

    if (postData.status !== "locked") {
      throw new HttpError("Can only watch locked posts", 400);
    }

    // Check if already watching
    const [existing] = await db
      .select()
      .from(watcher)
      .where(and(eq(watcher.userId, userId), eq(watcher.postId, postId)))
      .limit(1);

    if (existing) {
      throw new HttpError("Already watching this post", 400);
    }

    // Add to watchlist
    await db.insert(watcher).values({
      userId,
      postId,
    });
  }

  static async unwatchPost(userId: string, postId: string): Promise<void> {
    const result = await db
      .delete(watcher)
      .where(and(eq(watcher.userId, userId), eq(watcher.postId, postId)))
      .returning();

    if (result.length === 0) {
      throw new HttpError("Not watching this post", 404);
    }
  }

  static async create(input: CreatePostInput): Promise<PostWithAuthor> {
    const { authorId, title, content, unlockAt, tags = [] } = input;

    if (unlockAt <= new Date()) {
      throw new HttpError("Unlock date must be in the future", 400);
    }

    const result = await db.transaction(async (tx) => {
      const insertData: InsertPost = {
        authorId,
        title,
        content,
        unlockAt,
        status: "locked",
      };

      const [newPost] = await tx
        .insert(post)
        .values(insertData)
        .returning();

      if (tags.length > 0) {
        const tagRecords = await Promise.all(
          tags.map(async (tagName) => {
            const normalizedTag = tagName.toLowerCase().trim();

            const [existingTag] = await tx
              .select()
              .from(tag)
              .where(eq(tag.name, normalizedTag))
              .limit(1);

            if (existingTag) {
              return existingTag;
            }

            const [newTag] = await tx
              .insert(tag)
              .values({ name: normalizedTag })
              .returning();

            return newTag;
          })
        );

        await tx.insert(postTag).values(
          tagRecords.map((t) => ({
            postId: newPost.id,
            tagId: t.id,
          }))
        );
      }

      const [postWithAuthor] = await tx
        .select({
          id: post.id,
          title: post.title,
          content: post.content,
          status: post.status,
          unlockAt: post.unlockAt,
          unlockedAt: post.unlockedAt,
          viewCount: post.viewCount,
          createdAt: post.createdAt,
          author: {
            id: user.id,
            name: user.name,
            username: user.username,
            image: user.image,
          },
        })
        .from(post)
        .innerJoin(user, eq(post.authorId, user.id))
        .where(eq(post.id, newPost.id));

      return postWithAuthor;
    });

    return {
      ...result,
      id: result.id,
      status: result.status as "locked" | "public" | "archived",
    };
  }
}
