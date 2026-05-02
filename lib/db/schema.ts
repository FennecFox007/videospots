import {
  pgTable,
  text,
  integer,
  timestamp,
  primaryKey,
  uniqueIndex,
  serial,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =============================================================================
// Auth.js (NextAuth v5) tables — schema follows the official Drizzle adapter.
// https://authjs.dev/getting-started/adapters/drizzle
// We include all four tables now even though auth isn't wired up yet, so we
// don't need a migration when it is.
// =============================================================================

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // bcrypt hash for the Credentials login. Set by admin via /admin/users.
  passwordHash: text("password_hash"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// =============================================================================
// App domain tables
// =============================================================================

// Country = a market we operate in. Admin-editable.
export const countries = pgTable("country", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // ISO-3166-1 alpha-2: CZ, SK, HU, PL...
  name: text("name").notNull(),
  flagEmoji: text("flag_emoji"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chain = a retail brand whose stores host our screens. Admin-editable.
export const chains = pgTable("chain", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // datart, alza, mediamarkt, ...
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Channel = (Country × Chain) virtual broadcast unit.
// All screens of "Datart in CZ" play the same content, so we plan at this
// level — never per individual screen.
export const channels = pgTable(
  "channel",
  {
    id: serial("id").primaryKey(),
    countryId: integer("country_id")
      .notNull()
      .references(() => countries.id, { onDelete: "cascade" }),
    chainId: integer("chain_id")
      .notNull()
      .references(() => chains.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("channel_country_chain_idx").on(t.countryId, t.chainId)]
);

// Product metadata: what's being promoted in a campaign. Most often a game,
// but also consoles, controllers, accessories or services.
//
// JS export is `products`; the DB table is still called "game" — renaming a
// live table would need a manual migration and there's no payoff. The `kind`
// column distinguishes types in code/UI.
export const products = pgTable("game", {
  id: serial("id").primaryKey(),
  igdbId: integer("igdb_id").unique(),
  name: text("name").notNull(),
  // game | console | controller | accessory | service | other
  kind: text("kind").notNull().default("game"),
  slug: text("slug"),
  coverUrl: text("cover_url"),
  summary: text("summary"),
  releaseDate: timestamp("release_date", { mode: "date" }),
  rawIgdb: jsonb("raw_igdb"), // kept for forward compatibility
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

/** @deprecated Renamed to `products`. Kept as an alias for incremental migration. */
export const games = products;

// Campaign = a video spot scheduled for a date range on a set of channels.
//
// Status: there's no draft/approval workflow — a campaign is either active or
// explicitly cancelled.
//   - 'approved'  — active (default; legacy value kept so audit history stays
//                   readable; user-facing label is "Aktivní")
//   - 'cancelled' — historical mark, set via the detail-page button
// "Active / upcoming / done" are computed from dates, not stored.
export const campaigns = pgTable("campaign", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  client: text("client"), // e.g. "Sony Interactive Entertainment"
  videoUrl: text("video_url"),
  productId: integer("game_id").references(() => products.id, {
    onDelete: "set null",
  }),
  startsAt: timestamp("starts_at", { mode: "date" }).notNull(),
  endsAt: timestamp("ends_at", { mode: "date" }).notNull(),
  status: text("status").notNull().default("approved"), // approved | cancelled
  // Communication intent of the campaign — preorder / launch / outnow / dlc /
  // update / promo / sale / bundle / brand. Drives badges and filters. See
  // lib/communication.ts for the canonical list.
  communicationType: text("communication_type"),
  // Hex color used for the timeline bar. Picked from a fixed palette in the
  // form so it always contrasts with white text. See lib/colors.ts.
  color: text("color").notNull().default("#3b82f6"),
  // Free-form labels (priority, season, theme…). Filterable in the UI.
  tags: text("tags").array(),
  notes: text("notes"),
  // (DB column stays `game_id`; renamed to `productId` in JS — see products
  // table comment.)
  // Soft-delete timestamp. Non-null = "archived" (hidden from default lists,
  // restorable from /admin/archive). Null = active.
  archivedAt: timestamp("archived_at", { mode: "date" }),
  createdById: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Junction: which channels does this campaign run on?
export const campaignChannels = pgTable(
  "campaign_channel",
  {
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.channelId] })]
);

// Audit log — multi-user shared tool, so we want "who changed what when".
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(), // created | updated | deleted | approved | cancelled
  entity: text("entity").notNull(), // campaign | country | chain | channel
  entityId: integer("entity_id"),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  changes: jsonb("changes"), // snapshot or diff
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Read-only public links to share a campaign or a date-range view with a
// client. Token is checked at /share/[token]; no login required.
export const shareLinks = pgTable("share_link", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  // What the link reveals. One of:
  //   - { type: "campaign", campaignId: N }
  //   - { type: "timeline", from: "...", to: "..." }
  payload: jsonb("payload").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  createdById: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Threaded discussion under a campaign. Internal-only (auth required).
export const comments = pgTable("comment", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reusable campaign templates ("Saros + obvyklé kanály + 14 dní"). Used to
// seed a new campaign form with sensible defaults.
export const campaignTemplates = pgTable("campaign_template", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Full payload: name, client, color, tags, default duration days, channelIds[]
  payload: jsonb("payload").notNull(),
  createdById: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =============================================================================
// Relations (for Drizzle's relational queries API)
// =============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  campaigns: many(campaigns),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const countriesRelations = relations(countries, ({ many }) => ({
  channels: many(channels),
}));

export const chainsRelations = relations(chains, ({ many }) => ({
  channels: many(channels),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  country: one(countries, {
    fields: [channels.countryId],
    references: [countries.id],
  }),
  chain: one(chains, {
    fields: [channels.chainId],
    references: [chains.id],
  }),
  campaignChannels: many(campaignChannels),
}));

export const productsRelations = relations(products, ({ many }) => ({
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  product: one(products, {
    fields: [campaigns.productId],
    references: [products.id],
  }),
  createdBy: one(users, {
    fields: [campaigns.createdById],
    references: [users.id],
  }),
  campaignChannels: many(campaignChannels),
}));

export const campaignChannelsRelations = relations(
  campaignChannels,
  ({ one }) => ({
    campaign: one(campaigns, {
      fields: [campaignChannels.campaignId],
      references: [campaigns.id],
    }),
    channel: one(channels, {
      fields: [campaignChannels.channelId],
      references: [channels.id],
    }),
  })
);

export const commentsRelations = relations(comments, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [comments.campaignId],
    references: [campaigns.id],
  }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
}));
