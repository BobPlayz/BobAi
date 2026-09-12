import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const authIdentities = pgTable("auth_identities", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerSubject: text("provider_subject").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  providerSubjectUnique: uniqueIndex("auth_identities_provider_subject_idx").on(table.provider, table.providerSubject),
  userProviderUnique: uniqueIndex("auth_identities_user_provider_idx").on(table.userId, table.provider),
  userIdx: index("auth_identities_user_idx").on(table.userId)
}));
