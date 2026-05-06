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
// Auth — JWT-only via Auth.js Credentials provider, not the Drizzle adapter.
//
// We previously declared the full DrizzleAdapter scaffolding (account /
// session / verificationToken tables + emailVerified + image columns)
// against a possible future need for DB sessions or social login. None
// of that is wired up; the columns/tables are dropped from the schema in
// the 2026-05 cleanup. The DB still has them as orphan storage — see
// "Schema drift (Tier 3 soft-removal)" in STAV.md. If we ever switch to
// DB-backed Auth.js sessions, restore the deleted declarations from the
// Auth.js drizzle adapter docs and `db:push`; the existing DB tables
// will line up.
// =============================================================================

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  // bcrypt hash for the Credentials login. Set by admin via /admin/users.
  passwordHash: text("password_hash"),
  // Role-based access. "admin" = full app + /admin/* incl. user/role mgmt;
  // "editor" = create/edit/delete campaigns + spots, no /admin; "viewer"
  // = read-only (peek panel, share view, no mutations). Default is "admin"
  // ONLY so the migration backfill makes the existing seed user an admin
  // — every createUser INSERT must specify the role explicitly going
  // forward. See lib/roles.ts for the canonical type + helpers.
  role: text("role").notNull().default("admin"),
});

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
//
// FK behaviour: country + chain are `restrict` on delete. Cascading would
// silently nuke every channel when an admin deletes a country or chain,
// which then cascades down to campaign_channels (also cascade) — so a
// single misclick in /admin/countries could drop a working campaign's
// retailer assignments. Restrict forces the admin to delete the channels
// (and any blocking campaigns) explicitly first.
export const channels = pgTable(
  "channel",
  {
    id: serial("id").primaryKey(),
    countryId: integer("country_id")
      .notNull()
      .references(() => countries.id, { onDelete: "restrict" }),
    chainId: integer("chain_id")
      .notNull()
      .references(() => chains.id, { onDelete: "restrict" }),
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
//
// IGDB-related columns (igdbId / slug / rawIgdb / fetchedAt) were dropped
// from this schema in the 2026-05 cleanup — the IGDB integration is in
// "out of scope" and the columns were never written. The DB still has them
// as orphan storage; see "Schema drift" note in STAV.md.
export const products = pgTable("game", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // game | console | controller | accessory | service | other
  kind: text("kind").notNull().default("game"),
  coverUrl: text("cover_url"),
  summary: text("summary"),
  releaseDate: timestamp("release_date", { mode: "date" }),
});

// Campaign = a video spot scheduled for a date range on a set of channels.
//
// Status: there's no draft/approval workflow — a campaign is either active or
// explicitly cancelled.
//   - 'approved'  — active (default; legacy value kept so audit history stays
//                   readable; user-facing label is "Aktivní")
//   - 'cancelled' — historical mark, set via the detail-page button
// "Active / upcoming / done" are computed from dates, not stored.
//
// `videoUrl` (deprecated single-URL-per-campaign) was dropped from this
// schema in the 2026-05 cleanup. Per-country URLs live on spots.videoUrl
// (joined via campaignVideos). The DB column still exists as orphan
// storage; see STAV.md "Schema drift".
export const campaigns = pgTable("campaign", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  client: text("client"), // e.g. "Sony Interactive Entertainment"
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
  // Approval — set when an authenticated user clicks "Schvaluji" on the
  // campaign (from the timeline bar's right-click menu, the peek panel, or
  // the detail page). Share view is read-only; third-party recipients can
  // see the badge but can't write. NULL = waiting; non-null = approved.
  // Permanent: subsequent edits don't invalidate approval (per partner).
  //
  // Column names kept as `client_approved_*` for DB-migration ergonomics
  // (renaming a populated column means a multi-step DDL dance). The
  // `client` prefix is historical — the JS-level field has the same name
  // for now, and we just understand "client_" here as "campaign-level".
  clientApprovedAt: timestamp("client_approved_at", { mode: "date" }),
  // Optional approval note. Free-form text the approver can leave alongside
  // the click — handy for "schválil jsem, ale prosím přemístit z 5.5. na
  // 8.5." type sticky notes.
  clientApprovedComment: text("client_approved_comment"),
  // Who approved. Null when no one has approved yet, OR when the user got
  // deleted later (onDelete: set null preserves the audit ordering even
  // if a teammate leaves the org).
  approvedById: text("approved_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdById: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Junction: which channels does this campaign run on?
//
// Per-channel overrides:
//  - startsAt / endsAt — when this ONE channel needs a different schedule
//    than the rest of the campaign (e.g. Datart sells the product out a week
//    early — we end the spot in CZ-Datart on day 7, leave Alza, MediaMarkt
//    etc. running to day 14). NULL = inherit from campaigns.startsAt/endsAt.
//  - cancelledAt — turn this ONE channel off without cancelling the whole
//    campaign. Distinct from campaigns.status='cancelled' which cancels
//    everywhere. NULL = active in this channel.
//
// All three default to NULL on insert; the partner explicitly described this
// as an "exception" feature, not a per-channel-everywhere rewrite, so the
// common case stays "all channels follow the campaign".
export const campaignChannels = pgTable(
  "campaign_channel",
  {
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { mode: "date" }),
    endsAt: timestamp("ends_at", { mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { mode: "date" }),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.channelId] })]
);

// Spot = a concrete piece of video creative. (product × country × videoUrl)
// — same product + country + URL = same spot. Created either explicitly via
// /spots or implicitly when a campaign form is saved with a URL that doesn't
// match any existing spot.
//
// Spots are reusable: one spot can be deployed across multiple campaigns
// (e.g. the "Saros launch CZ" spot used in the launch campaign and again
// later for an anniversary push). A spot with no campaignVideos rows is
// "undeployed" — surfaced on the dashboard so finished creatives don't
// silently fall off the radar.
//
// productId nullable: brand campaigns / non-game spots are rare but possible.
// archivedAt: soft-delete. archived spots are hidden from default lists but
// stay attached to historical campaign_video rows.
export const spots = pgTable("spot", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  // restrict for the same reason channels.country_id is restrict — deleting
  // a country shouldn't silently take spots with it, and campaign_video.spotId
  // would block such a delete with `restrict` anyway. Better to fail loudly
  // at the country level.
  countryId: integer("country_id")
    .notNull()
    .references(() => countries.id, { onDelete: "restrict" }),
  videoUrl: text("video_url").notNull(),
  // Optional human-readable name. When null, UI synthesises one from the
  // joined product name + country code ("Saros · CZ").
  name: text("name"),
  archivedAt: timestamp("archived_at", { mode: "date" }),
  createdById: text("created_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Production status — manual workflow states + the "schvalen" terminal
  // state set by client approval. Drives the timeline bar visual and the
  // /spots list filter. See lib/spot-status.ts for the full state machine
  // + i18n + Pill tone helpers.
  //
  // States:
  //   bez_zadani         → spot doesn't have a videoUrl yet (or never set)
  //   zadan              → editor flagged "Sony zadalo, začneme dělat"
  //   ve_vyrobe          → editor flagged "aktuálně se vyrábí"
  //   ceka_na_schvaleni  → has videoUrl, waiting for client approval
  //   schvalen           → client clicked "schvaluji" (also sets clientApprovedAt)
  //
  // Three derived states ("naplanovan" / "bezi" / "skoncil") are computed
  // per-deployment from campaign_channel dates relative to today; they're
  // never stored. See resolveSpotDisplayStatus() in lib/spot-status.ts.
  //
  // Auto-transitions on updateSpot:
  //   - videoUrl set first time AND status was bez_zadani/zadan/ve_vyrobe
  //     → ceka_na_schvaleni
  //   - videoUrl changed AND status was schvalen
  //     → ceka_na_schvaleni (resets approval — different creative, sign-off
  //       no longer applies)
  productionStatus: text("production_status").notNull().default("bez_zadani"),
  // Set when productionStatus transitions to "schvalen". Kept as a separate
  // timestamp so we know *when* it was approved (status alone is just current
  // state). Cleared on auto-reset (videoUrl change). Mirrored on the
  // (now deprecated) campaigns.clientApprovedAt for the legacy 1.x model.
  clientApprovedAt: timestamp("client_approved_at", { mode: "date" }),
  clientApprovedComment: text("client_approved_comment"),
  approvedById: text("approved_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

// Per-country spot deployment for a campaign. (campaign × country) → spot.
// Country redundancy with spot.countryId is kept on the junction so the
// (campaign, country) primary key still enforces "one spot per country per
// campaign" without needing a check constraint.
//
// Historical: previous schema kept video_url directly on this row. The
// 2026-05 spots refactor moved URLs into the spots table and replaced
// video_url with spot_id (NOT NULL).
export const campaignVideos = pgTable(
  "campaign_video",
  {
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    countryId: integer("country_id")
      .notNull()
      .references(() => countries.id, { onDelete: "cascade" }),
    spotId: integer("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.countryId] })]
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
//
// Lifecycle: a link is "active" iff `revokedAt IS NULL AND (expiresAt IS NULL
// OR expiresAt > now)`. Centralised in `lib/db/queries.ts` (`shareLinkIsActive
// Sql`) so the predicate lives in one place. Soft-revocation (instead of DELETE)
// preserves audit trail: kdo revoknul, kdy, jaká kampaň byla sdílená — useful
// when an agent receives a leaked link from a client and wants to know
// who originally shared it.
export const shareLinks = pgTable("share_link", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  // What the link reveals. One of:
  //   - { type: "campaign", campaignId: N }
  //   - { type: "timeline", filters: { from, to, q, country, ... } }
  payload: jsonb("payload").notNull(),
  // Optional human note shown in the management list — "Pre-launch preview
  // pro Maňáska", "Q3 campaign roundup". Helps tell links apart when an
  // editor has 5 active for the same campaign.
  label: text("label"),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  // Set when an editor explicitly disables the link before its natural
  // expiry. Null = active (subject to expiresAt). Once set, the row stays
  // for audit purposes; the lookup at /share/[token] treats it as 404.
  revokedAt: timestamp("revoked_at", { mode: "date" }),
  revokedById: text("revoked_by").references(() => users.id, {
    onDelete: "set null",
  }),
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

// Per-user named filter bookmarks. A "saved view" is just a stored set of
// URL search-params (q, country, chain, runState, approval, missingSpot,
// tag, from, to) scoped to a particular page ("timeline" or "campaigns").
// Canonical allowlist lives in app/saved-views/actions.ts. Click loads them.
//
// Keeping this per-user (not shared) by design — different team members care
// about different slices, and a global "shared filters" list invites bikeshed.
export const savedViews = pgTable("saved_view", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  scope: text("scope").notNull(), // "timeline" | "campaigns"
  // Whitelist of allowed URL params, stored as flat string-string map.
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =============================================================================
// Relations (for Drizzle's relational queries API)
// =============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  campaigns: many(campaigns),
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
