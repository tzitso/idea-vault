import { db } from "@/db";
import { post, tag, postTag, user, watcher, InsertPost, like } from "@/db/schema";
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
    // Fetch watch counts
    const watchCounts = await db
      .select({
        postId: watcher.postId,
        count: sql<number>`count(*)::int`,
      })
      .from(watcher)
      .where(inArray(watcher.postId, postIds))
      .groupBy(watcher.postId);

    // Fetch like counts
    const likeCounts = await db
      .select({
        postId: like.postId,
        count: sql<number>`count(*)::int`,
      })
      .from(like)
      .where(inArray(like.postId, postIds))
      .groupBy(like.postId);

    // Fetch user's watch status if userId provided
    let userWatches: Set<string> = new Set();
    let userLikes: Set<string> = new Set();
    
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

      const likes = await db
        .select({ postId: like.postId })
        .from(like)
        .where(
          and(
            eq(like.userId, userId),
            inArray(like.postId, postIds)
          )
        );
      userLikes = new Set(likes.map((l) => l.postId));
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

    // Map like counts
    const likeCountByPost = new Map<string, number>();
    for (const lc of likeCounts) {
      likeCountByPost.set(lc.postId, lc.count);
    }

    return posts.map((p) => ({
      ...p,
      id: p.id,
      status: p.status as "locked" | "public" | "archived",
      title: p.status === "locked" ? null : p.title,
      content: p.status === "locked" ? null : p.content,
      isLocked: p.status === "locked",
      watchCount: watchCountByPost.get(p.id) || 0,
      likeCount: likeCountByPost.get(p.id) || 0,
      isWatching: userId ? userWatches.has(p.id) : undefined,
      isLiked: userId ? userLikes.has(p.id) : undefined,
      tags: tagsByPost.get(p.id) || [],
    }));
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

      // Fetch tags for the new post
      const postTags = await tx
        .select({
          tagId: tag.id,
          tagName: tag.name,
        })
        .from(postTag)
        .innerJoin(tag, eq(postTag.tagId, tag.id))
        .where(eq(postTag.postId, newPost.id));

        return {
          ...postWithAuthor,
          id: postWithAuthor.id,
          status: postWithAuthor.status as "locked" | "public" | "archived",
          title: postWithAuthor.status === "locked" ? null : postWithAuthor.title,
          content: postWithAuthor.status === "locked" ? null : postWithAuthor.content,
          isLocked: postWithAuthor.status === "locked",
          watchCount: 0,
          likeCount: 0, // Added
          tags: postTags.map((t) => ({
            id: t.tagId,
            name: t.tagName,
          })),
        };
    });

    return result;
  }

  static async watchPost(userId: string, postId: string): Promise<void> {
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

    const [existing] = await db
      .select()
      .from(watcher)
      .where(and(eq(watcher.userId, userId), eq(watcher.postId, postId)))
      .limit(1);

    if (existing) {
      throw new HttpError("Already watching this post", 400);
    }

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

  static async getById(postId: string, userId?: string): Promise<PostWithAuthor> {
    const [postData] = await db
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
      .where(eq(post.id, postId))
      .limit(1);

    if (!postData) {
      throw new HttpError("Post not found", 404);
    }

    // Fetch tags
    const postTags = await db
      .select({
        tagId: tag.id,
        tagName: tag.name,
      })
      .from(postTag)
      .innerJoin(tag, eq(postTag.tagId, tag.id))
      .where(eq(postTag.postId, postId));

    // Fetch watch count
    const [watchCountData] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(watcher)
      .where(eq(watcher.postId, postId));

    // Fetch like count
    const [likeCountData] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(like)
      .where(eq(like.postId, postId));

    // Check if user is watching/liked
    let isWatching: boolean | undefined;
    let isLiked: boolean | undefined;

    if (userId) {
      const [watchStatus] = await db
        .select()
        .from(watcher)
        .where(and(eq(watcher.userId, userId), eq(watcher.postId, postId)))
        .limit(1);
      isWatching = !!watchStatus;

      const [likeStatus] = await db
        .select()
        .from(like)
        .where(and(eq(like.userId, userId), eq(like.postId, postId)))
        .limit(1);
      isLiked = !!likeStatus;
    }

    // Increment view count (fire and forget)
    db.update(post)
      .set({ viewCount: sql`${post.viewCount} + 1` })
      .where(eq(post.id, postId))
      .execute();

    return {
      ...postData,
      id: postData.id,
      status: postData.status as "locked" | "public" | "archived",
      title: postData.status === "locked" ? null : postData.title,
      content: postData.status === "locked" ? null : postData.content,
      isLocked: postData.status === "locked",
      watchCount: watchCountData?.count || 0,
      likeCount: likeCountData?.count || 0,
      isWatching,
      isLiked,
      tags: postTags.map((t) => ({
        id: t.tagId,
        name: t.tagName,
      })),
    };
  }

  static async likePost(userId: string, postId: string): Promise<void> {
    // Check if post exists
    const [postData] = await db
      .select({ id: post.id })
      .from(post)
      .where(eq(post.id, postId))
      .limit(1);

    if (!postData) {
      throw new HttpError("Post not found", 404);
    }

    // Check if already liked
    const [existing] = await db
      .select()
      .from(like)
      .where(and(eq(like.userId, userId), eq(like.postId, postId)))
      .limit(1);

    if (existing) {
      throw new HttpError("Already liked this post", 400);
    }

    // Add like
    await db.insert(like).values({
      userId,
      postId,
    });
  }

  static async unlikePost(userId: string, postId: string): Promise<void> {
    const result = await db
      .delete(like)
      .where(and(eq(like.userId, userId), eq(like.postId, postId)))
      .returning();

    if (result.length === 0) {
      throw new HttpError("Not liked this post", 404);
    }
  }
}
