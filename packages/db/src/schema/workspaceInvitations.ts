import { index, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";

export const workspaceInvitations = pgTable("workspace_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  permissions: text("permissions"),
  tokenHash: text("token_hash").notNull(),
  invitedBy: uuid("invited_by").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  workspaceEmailUnique: uniqueIndex("workspace_invitations_workspace_email_unique").on(table.workspaceId, table.email),
  tokenUnique: uniqueIndex("workspace_invitations_token_hash_unique").on(table.tokenHash),
  workspaceIdx: index("workspace_invitations_workspace_idx").on(table.workspaceId, table.createdAt),
}));
