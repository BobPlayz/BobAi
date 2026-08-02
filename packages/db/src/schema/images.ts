import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer
} from "drizzle-orm/pg-core";

export const images = pgTable("images", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id").notNull(),

  uploadId: uuid("upload_id"),

  createdBy: uuid("created_by"),

  prompt: text("prompt"),

  negativePrompt: text("negative_prompt"),

  model: text("model"),

  width: integer("width"),

  height: integer("height"),

  seed: integer("seed"),

  style: text("style"),

  operation: text("operation").notNull().default("generate"),

  parentImageId: uuid("parent_image_id"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});