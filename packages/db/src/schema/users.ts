import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash"),
  role: text("role").default("user").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  emailVerifiedAt: timestamp("email_verified_at"),
  mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
  mfaSecretEncrypted: text("mfa_secret_encrypted"),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  termsVersion: text("terms_version"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
