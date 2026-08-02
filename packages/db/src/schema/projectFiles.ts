import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer
} from "drizzle-orm/pg-core";

export const projectFiles = pgTable("project_files", {
  id: uuid("id").defaultRandom().primaryKey(),

  projectId: uuid("project_id").notNull(),

  uploadedBy: uuid("uploaded_by"),

  name: text("name").notNull(),

  path: text("path").notNull(),

  mimeType: text("mime_type").notNull(),

  size: integer("size").notNull(),

  checksum: text("checksum"),

  metadata: jsonb("metadata"),

  extractedText: text("extracted_text"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  deletedAt: timestamp("deleted_at")
});