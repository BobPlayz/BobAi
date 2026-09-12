import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const authOAuthStates = pgTable("auth_oauth_states", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  stateHash: text("state_hash").notNull().unique(),
  codeVerifierEncrypted: text("code_verifier_encrypted").notNull(),
  nonceHash: text("nonce_hash").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  expiryIdx: index("auth_oauth_states_expiry_idx").on(table.expiresAt)
}));
