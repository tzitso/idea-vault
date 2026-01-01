import { relations, InferSelectModel, InferInsertModel } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, integer, uuid, varchar, pgEnum } from "drizzle-orm/pg-core";

// ============= AUTH TABLES =============

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  bio: text("bio"),
  username: varchar("username", { length: 50 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// ============= SOCIAL NETWORK TABLES =============

export const postStatusEnum = pgEnum("post_status", ["locked", "public", "archived"]);

export const post = pgTable(
  "post",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    status: postStatusEnum("status").default("locked").notNull(),
    unlockAt: timestamp("unlock_at").notNull(),
    unlockedAt: timestamp("unlocked_at"),
    viewCount: integer("view_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("post_authorId_idx").on(table.authorId),
    index("post_status_idx").on(table.status),
    index("post_unlockAt_idx").on(table.unlockAt),
    index("post_createdAt_idx").on(table.createdAt),
  ],
);

export const tag = pgTable("tag", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const postTag = pgTable(
  "post_tag",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("postTag_postId_idx").on(table.postId),
    index("postTag_tagId_idx").on(table.tagId),
  ],
);

// ============= RELATIONS =============

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  posts: many(post),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const postRelations = relations(post, ({ one, many }) => ({
  author: one(user, {
    fields: [post.authorId],
    references: [user.id],
  }),
  tags: many(postTag),
}));

export const tagRelations = relations(tag, ({ many }) => ({
  posts: many(postTag),
}));

export const postTagRelations = relations(postTag, ({ one }) => ({
  post: one(post, {
    fields: [postTag.postId],
    references: [post.id],
  }),
  tag: one(tag, {
    fields: [postTag.tagId],
    references: [tag.id],
  }),
}));

export const watcher = pgTable(
  "watcher",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    notified: boolean("notified").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("watcher_userId_idx").on(table.userId),
    index("watcher_postId_idx").on(table.postId),
    index("watcher_unique_idx").on(table.userId, table.postId),
  ],
);

export const watcherRelations = relations(watcher, ({ one }) => ({
  user: one(user, {
    fields: [watcher.userId],
    references: [user.id],
  }),
  post: one(post, {
    fields: [watcher.postId],
    references: [post.id],
  }),
}));

export type Watcher = InferSelectModel<typeof watcher>;
export type InsertWatcher = InferInsertModel<typeof watcher>;

// ============= TYPES =============

export type User = InferSelectModel<typeof user>;
export type InsertUser = InferInsertModel<typeof user>;

export type Post = InferSelectModel<typeof post>;
export type InsertPost = InferInsertModel<typeof post>;

export type Tag = InferSelectModel<typeof tag>;
export type InsertTag = InferInsertModel<typeof tag>;
