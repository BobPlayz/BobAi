import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb
} from "drizzle-orm/pg-core";

export const uploads = pgTable("uploads", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id").notNull(),

  uploadedBy: uuid("uploaded_by"),

  storageKey: text("storage_key").notNull(),

  originalName: text("original_name").notNull(),

  mimeType: text("mime_type").notNull(),

  size: integer("size").notNull(),

  checksum: text("checksum"),

  storageProvider: text("storage_provider").notNull().default("s3"),

  bucket: text("bucket"),

  metadata: jsonb("metadata"),

  extractedText: text("extracted_text"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});