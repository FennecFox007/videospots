// Translation dictionary. Keep keys flat (e.g. "timeline.tip") to avoid the
// nested-object dance — every key is just a string lookup, no interpolation
// runtime needed. Variables in messages use {name} placeholders, replaced
// by `format()` in the server/client t() implementations.
//
// Coverage policy:
//  - User-facing surfaces clients might see (timeline, detail, list, releases,
//    share, print, nav, sign-in, dialog text) → both CS and EN.
//  - Admin pages, edit/new forms, /tools/find-slot → Czech only for now.
//    Adding EN later is straightforward — just add the keys.
//
// When adding a key, add to BOTH dicts. TypeScript would catch missing keys
// thanks to `MessageKey`, but it doesn't catch an EN string that's still
// Czech — review pass needed.

export type Locale = "cs" | "en";
export const LOCALES: readonly Locale[] = ["cs", "en"] as const;
export const DEFAULT_LOCALE: Locale = "cs";

export const LOCALE_LABELS: Record<Locale, string> = {
  cs: "Čeština",
  en: "English",
};

const cs = {
  // Nav
  "nav.timeline": "Timeline",
  "nav.releases": "Releasy",
  "nav.list": "Seznam",
  "nav.new": "+ Nová",
  "nav.find_slot": "Volný termín",
  "nav.templates": "Šablony",
  "nav.admin": "Admin",
  "nav.activity": "Aktivita",
  "nav.signout": "Odhlásit",
  "nav.search_hint": "Hledat",

  // Sign in
  "signin.title": "videospots",
  "signin.subtitle": "Plánování video kampaní",
  "signin.email": "E-mail",
  "signin.password": "Heslo",
  "signin.submit": "Přihlásit se",
  "signin.invalid": "Neplatný e-mail nebo heslo",

  // Common
  "common.cancel": "Zrušit",
  "common.save": "Uložit",
  "common.confirm": "OK",
  "common.close": "Zavřít",
  "common.delete": "Smazat",
  "common.edit": "Upravit",
  "common.open": "Otevřít",
  "common.back": "Zpět",
  "common.loading": "Načítám…",
  "common.search": "Hledat",
  "common.filter": "Filtrovat",
  "common.clear_filters": "Vyčistit filtry",
  "common.empty": "—",
  "common.client": "Klient",
  "common.product": "Produkt",
  "common.channels": "Kanály",
  "common.notes": "Poznámky",
  "common.tags": "Štítky",
  "common.color": "Barva",
  "common.start": "Začátek",
  "common.end": "Konec",
  "common.duration": "Délka",
  "common.status": "Stav",
  "common.video": "Video",
  "common.tip": "Tip",

  // Timeline
  "timeline.heading": "Timeline",
  "timeline.tip":
    "táhni za střed = posun, za okraj = délka, klik = otevřít detail, ▶ na baru = přehrát spot. Hlavičku s dny chytni a táhni pro posun v čase, shift+táhnout = snap na pondělí, dvojklik = skok na dnešek.",
  "timeline.share": "Sdílet",
  "timeline.print": "Tisk / PDF",
  "timeline.list_link": "Seznam kampaní",
  "timeline.new_campaign": "+ Nová kampaň",
  "timeline.shift_back": "Posunout o týden zpět",
  "timeline.shift_forward": "Posunout o týden vpřed",
  "timeline.today": "Dnes",
  "timeline.zoom_week": "Týden",
  "timeline.zoom_2weeks": "2 týdny",
  "timeline.zoom_month": "Měsíc",
  "timeline.zoom_quarter": "Kvartál",
  "timeline.preset_this_week": "Tento týden",
  "timeline.preset_next_week": "Příští týden",
  "timeline.preset_this_month": "Tento měsíc",
  "timeline.preset_next_month": "Příští měsíc",
  "timeline.channel_col": "Kanál",
  "timeline.no_channels": "Žádné kanály. Nastav matici v",
  "timeline.no_channels_link": "administraci",
  "timeline.no_campaigns_in_range": "Zatím žádné kampaně v tomto rozsahu.",
  "timeline.create_first": "Vytvoř první",
  "timeline.now_marker": "DNES",
  "timeline.bar_play": "Přehrát spot v novém panelu",
  "timeline.country_collapse_hint":
    "Klik = sbalit/rozbalit zemi · pravoklik = další akce",
  "timeline.bar_cancelled": "(zrušeno)",
  "timeline.bar_running_now": "Právě běží",
  "timeline.bar_upcoming": "Čeká na start",
  "timeline.bar_done": "Doběhlo",
  "timeline.bar_cancelled_state": "Zrušeno",
  "timeline.preview_will_show": "Zobrazí",
  "timeline.preview_snap_monday": "↦ Po",

  // Dashboard widgets
  "dashboard.running.empty_title": "Právě teď nic neběží",
  "dashboard.running.empty_desc": "Žádná aktivní kampaň se právě teď nepřehrává.",
  "dashboard.running.title": "Právě běží",
  "dashboard.upcoming.empty_title": "Žádné naplánované",
  "dashboard.upcoming.empty_desc":
    "V příštích {days} dnech není naplánovaná žádná schválená kampaň.",
  "dashboard.upcoming.title": "Naplánováno na příštích {days} dní",
  "dashboard.ending.empty_title": "Žádná kampaň brzy nekončí",
  "dashboard.ending.empty_desc":
    "V příštích {days} dnech nekončí žádná aktivně běžící kampaň.",
  "dashboard.ending.title": "Konec do {days} dnů",
  "dashboard.stats.total_campaigns": "Celkem kampaní",
  "dashboard.stats.this_month": "běží/poběží v {month}",
  "dashboard.stats.screen_days": "Screen-days tento měsíc",
  "dashboard.stats.screen_days_sub": "aktivních × dní × kanálů",
  "dashboard.stats.top_client": "Top klient",
  "dashboard.stats.top_product": "Top hra",
  "dashboard.stats.no_yet": "zatím žádný",
  "dashboard.in_days": "za {n} {unit}",
  "dashboard.today": "dnes",
  "dashboard.until": "do {date}",

  // Campaigns list
  "list.heading": "Seznam kampaní",
  "list.export_csv": "Export CSV",
  "list.col.campaign": "Kampaň",
  "list.col.client": "Klient",
  "list.col.product": "Produkt",
  "list.col.start": "Začátek",
  "list.col.duration": "Délka",
  "list.col.channels": "Kanály",
  "list.col.status": "Stav",
  "list.col.tags": "Štítky",
  "list.empty.title": "Žádné kampaně neodpovídají filtrům.",
  "list.empty.clear": "Vyčistit filtry",
  "list.bulk.cancel": "Zrušit (historicky)",
  "list.bulk.color": "Barva",
  "list.bulk.archive": "Archivovat",
  "list.bulk.selected": "vybráno",
  "list.tip":
    "Vyber kampaně levým checkboxem; spodní lišta nabídne hromadné akce (smazat / zrušit / změnit barvu).",

  // Filter bar
  "filter.search_placeholder": "Hledat (název, klient, hra)…",
  "filter.all_countries": "Všechny státy",
  "filter.all_chains": "Všechny řetězce",
  "filter.all_states": "Všechny stavy",
  "filter.all_clients": "Všichni klienti",
  "filter.all_tags": "Všechny štítky",
  "filter.all_comm_types": "Všechny typy komunikace",
  "filter.runstate.running": "Právě běží",
  "filter.runstate.upcoming": "Čeká na start",
  "filter.runstate.done": "Doběhlo",
  "filter.runstate.cancelled": "Zrušeno",
  "filter.saved_views": "Pohledy",
  "filter.save_current": "+ Uložit aktuální…",

  // Campaign detail
  "detail.back_to_timeline": "← Timeline",
  "detail.cancel_historic": "Zrušit (historicky)",
  "detail.reactivate": "Obnovit",
  "detail.edit": "Upravit",
  "detail.clone": "Klonovat",
  "detail.share": "Sdílet",
  "detail.save_template": "Uložit jako šablonu",
  "detail.print": "Tisk / PDF",
  "detail.archive": "Archivovat",
  "detail.archive_tooltip": "Přesunout do archivu (lze obnovit)",
  "detail.total_reach": "Total reach",
  "detail.screen_days": "screen-days",
  "detail.product_section": "Produkt",
  "detail.product_released": "Vyšlo {date}",
  "detail.videos_section": "Spoty podle země",
  "detail.channels_section": "Kanály",
  "detail.no_channels": "Žádné kanály.",
  "detail.notes_section": "Poznámky",
  "detail.comments_section": "Komentáře",
  "detail.comments_placeholder": "Napsat komentář…  (zmíň kolegu přes @username)",
  "detail.comments_submit": "Přidat komentář",
  "detail.history_section": "Historie změn",
  "detail.no_history": "Žádná historie.",
  "detail.deleted_user": "smazaný uživatel",

  // Releases
  "releases.heading": "Release kalendář",
  "releases.timeline": "Timeline",
  "releases.manage_products": "Spravovat produkty",
  "releases.empty": "Žádné nadcházející releasy.",
  "releases.empty_link": "Přidej produkt s datem vydání",
  "releases.released_on": "Vydání {date}",
  "releases.launch_campaign": "+ Launch kampaň",
  "releases.launch_campaign_tooltip":
    "Předvyplní formulář s tímhle produktem a launch oknem ±7 dní",
  "releases.status.released_days_ago": "Vyšlo před {n} {unit}",
  "releases.status.today": "Dnes!",
  "releases.status.in_days": "Za {n} {unit}",

  // Share view
  "share.preview_campaign": "Veřejný náhled kampaně",
  "share.preview_timeline": "Veřejný náhled timeline",
  "share.expires": "Tento odkaz je platný do {date}.",
  "share.open_app": "Otevřít aplikaci",
  "share.plan_heading": "Plán kampaní",

  // Print
  "print.subheading": "rozpis kampaně",
  "print.subheading_timeline": "rozpis kampaní",
  "print.created": "Vytvořeno {date}",
  "print.generated": "Generováno {date}",
  "print.scan_video": "Otevřít video",
  "print.scan_campaign": "Otevřít kampaň",
  "print.bg_tip":
    "Tip: pro plné barvy v PDF v Chrome zatrhni „Background graphics“ v print dialogu.",

  // Communication types (labels mostly stable across languages, kept here
  // for completeness; the badge component looks them up by value).
  "comm.preorder": "Pre-order",
  "comm.launch": "Launch",
  "comm.outnow": "Out Now",
  "comm.dlc": "DLC",
  "comm.update": "Update",
  "comm.promo": "Promo",
  "comm.sale": "Sleva",
  "comm.bundle": "Bundle",
  "comm.brand": "Brand",

  // Plurals: "den"-style — handled in code via pluralCs/pluralEn.
  "unit.day_one": "den",
  "unit.day_few": "dny",
  "unit.day_many": "dní",
  "unit.campaign_one": "kampaň",
  "unit.campaign_few": "kampaně",
  "unit.campaign_many": "kampaní",
  "unit.channel_one": "kanál",
  "unit.channel_few": "kanály",
  "unit.channel_many": "kanálů",
  "unit.country_one": "země",
  "unit.country_few": "země",
  "unit.country_many": "zemí",
  "unit.product_one": "produkt v pipeline",
  "unit.product_few": "produkty v pipeline",
  "unit.product_many": "produktů v pipeline",
} as const;

const en: Record<keyof typeof cs, string> = {
  // Nav
  "nav.timeline": "Timeline",
  "nav.releases": "Releases",
  "nav.list": "Campaigns",
  "nav.new": "+ New",
  "nav.find_slot": "Find a slot",
  "nav.templates": "Templates",
  "nav.admin": "Admin",
  "nav.activity": "Activity",
  "nav.signout": "Sign out",
  "nav.search_hint": "Search",

  // Sign in
  "signin.title": "videospots",
  "signin.subtitle": "Video campaign planner",
  "signin.email": "Email",
  "signin.password": "Password",
  "signin.submit": "Sign in",
  "signin.invalid": "Invalid email or password",

  // Common
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.confirm": "OK",
  "common.close": "Close",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.open": "Open",
  "common.back": "Back",
  "common.loading": "Loading…",
  "common.search": "Search",
  "common.filter": "Filter",
  "common.clear_filters": "Clear filters",
  "common.empty": "—",
  "common.client": "Client",
  "common.product": "Product",
  "common.channels": "Channels",
  "common.notes": "Notes",
  "common.tags": "Tags",
  "common.color": "Color",
  "common.start": "Start",
  "common.end": "End",
  "common.duration": "Duration",
  "common.status": "Status",
  "common.video": "Video",
  "common.tip": "Tip",

  // Timeline
  "timeline.heading": "Timeline",
  "timeline.tip":
    "drag the middle = move, drag the edge = resize, click = open detail, ▶ on bar = play the spot. Grab the days header to scrub through time, shift+drag = snap to Monday, double-click = jump to today.",
  "timeline.share": "Share",
  "timeline.print": "Print / PDF",
  "timeline.list_link": "Campaign list",
  "timeline.new_campaign": "+ New campaign",
  "timeline.shift_back": "Shift one week back",
  "timeline.shift_forward": "Shift one week forward",
  "timeline.today": "Today",
  "timeline.zoom_week": "Week",
  "timeline.zoom_2weeks": "2 weeks",
  "timeline.zoom_month": "Month",
  "timeline.zoom_quarter": "Quarter",
  "timeline.preset_this_week": "This week",
  "timeline.preset_next_week": "Next week",
  "timeline.preset_this_month": "This month",
  "timeline.preset_next_month": "Next month",
  "timeline.channel_col": "Channel",
  "timeline.no_channels": "No channels yet. Set up the matrix in",
  "timeline.no_channels_link": "Admin",
  "timeline.no_campaigns_in_range": "No campaigns in this range yet.",
  "timeline.create_first": "Create the first one",
  "timeline.now_marker": "NOW",
  "timeline.bar_play": "Play the spot in a new tab",
  "timeline.country_collapse_hint":
    "Click = collapse/expand country · right-click = more actions",
  "timeline.bar_cancelled": "(cancelled)",
  "timeline.bar_running_now": "Running now",
  "timeline.bar_upcoming": "Upcoming",
  "timeline.bar_done": "Finished",
  "timeline.bar_cancelled_state": "Cancelled",
  "timeline.preview_will_show": "Will show",
  "timeline.preview_snap_monday": "↦ Mon",

  // Dashboard widgets
  "dashboard.running.empty_title": "Nothing is running right now",
  "dashboard.running.empty_desc": "No active campaign is currently playing.",
  "dashboard.running.title": "Running now",
  "dashboard.upcoming.empty_title": "Nothing scheduled",
  "dashboard.upcoming.empty_desc":
    "No approved campaign is scheduled for the next {days} days.",
  "dashboard.upcoming.title": "Scheduled in next {days} days",
  "dashboard.ending.empty_title": "Nothing ending soon",
  "dashboard.ending.empty_desc":
    "No active campaign ends in the next {days} days.",
  "dashboard.ending.title": "Ending within {days} days",
  "dashboard.stats.total_campaigns": "Total campaigns",
  "dashboard.stats.this_month": "running in {month}",
  "dashboard.stats.screen_days": "Screen-days this month",
  "dashboard.stats.screen_days_sub": "active × days × channels",
  "dashboard.stats.top_client": "Top client",
  "dashboard.stats.top_product": "Top product",
  "dashboard.stats.no_yet": "none yet",
  "dashboard.in_days": "in {n} {unit}",
  "dashboard.today": "today",
  "dashboard.until": "until {date}",

  // Campaigns list
  "list.heading": "Campaigns",
  "list.export_csv": "Export CSV",
  "list.col.campaign": "Campaign",
  "list.col.client": "Client",
  "list.col.product": "Product",
  "list.col.start": "Start",
  "list.col.duration": "Duration",
  "list.col.channels": "Channels",
  "list.col.status": "Status",
  "list.col.tags": "Tags",
  "list.empty.title": "No campaigns match the filters.",
  "list.empty.clear": "Clear filters",
  "list.bulk.cancel": "Cancel (historic)",
  "list.bulk.color": "Color",
  "list.bulk.archive": "Archive",
  "list.bulk.selected": "selected",
  "list.tip":
    "Pick campaigns with the left checkbox; a bulk action bar appears at the bottom (delete / cancel / change color).",

  // Filter bar
  "filter.search_placeholder": "Search (name, client, product)…",
  "filter.all_countries": "All countries",
  "filter.all_chains": "All retailers",
  "filter.all_states": "All states",
  "filter.all_clients": "All clients",
  "filter.all_tags": "All tags",
  "filter.all_comm_types": "All comm. types",
  "filter.runstate.running": "Running",
  "filter.runstate.upcoming": "Upcoming",
  "filter.runstate.done": "Finished",
  "filter.runstate.cancelled": "Cancelled",
  "filter.saved_views": "Views",
  "filter.save_current": "+ Save current…",

  // Campaign detail
  "detail.back_to_timeline": "← Timeline",
  "detail.cancel_historic": "Cancel (historic)",
  "detail.reactivate": "Reactivate",
  "detail.edit": "Edit",
  "detail.clone": "Duplicate",
  "detail.share": "Share",
  "detail.save_template": "Save as template",
  "detail.print": "Print / PDF",
  "detail.archive": "Archive",
  "detail.archive_tooltip": "Move to archive (restorable)",
  "detail.total_reach": "Total reach",
  "detail.screen_days": "screen-days",
  "detail.product_section": "Product",
  "detail.product_released": "Released {date}",
  "detail.videos_section": "Spots by country",
  "detail.channels_section": "Channels",
  "detail.no_channels": "No channels.",
  "detail.notes_section": "Notes",
  "detail.comments_section": "Comments",
  "detail.comments_placeholder": "Write a comment…  (mention a teammate via @username)",
  "detail.comments_submit": "Add comment",
  "detail.history_section": "Change history",
  "detail.no_history": "No history.",
  "detail.deleted_user": "deleted user",

  // Releases
  "releases.heading": "Release calendar",
  "releases.timeline": "Timeline",
  "releases.manage_products": "Manage products",
  "releases.empty": "No upcoming releases.",
  "releases.empty_link": "Add a product with a release date",
  "releases.released_on": "Released {date}",
  "releases.launch_campaign": "+ Launch campaign",
  "releases.launch_campaign_tooltip":
    "Pre-fills the form with this product and a ±7-day launch window",
  "releases.status.released_days_ago": "Released {n} {unit} ago",
  "releases.status.today": "Today!",
  "releases.status.in_days": "In {n} {unit}",

  // Share view
  "share.preview_campaign": "Public campaign preview",
  "share.preview_timeline": "Public timeline preview",
  "share.expires": "This link is valid until {date}.",
  "share.open_app": "Open the app",
  "share.plan_heading": "Campaign plan",

  // Print
  "print.subheading": "campaign brief",
  "print.subheading_timeline": "campaign schedule",
  "print.created": "Created {date}",
  "print.generated": "Generated {date}",
  "print.scan_video": "Open video",
  "print.scan_campaign": "Open campaign",
  "print.bg_tip":
    "Tip: in Chrome, tick \"Background graphics\" in the print dialog for full-color bars.",

  "comm.preorder": "Pre-order",
  "comm.launch": "Launch",
  "comm.outnow": "Out Now",
  "comm.dlc": "DLC",
  "comm.update": "Update",
  "comm.promo": "Promo",
  "comm.sale": "Sale",
  "comm.bundle": "Bundle",
  "comm.brand": "Brand",

  "unit.day_one": "day",
  "unit.day_few": "days",
  "unit.day_many": "days",
  "unit.campaign_one": "campaign",
  "unit.campaign_few": "campaigns",
  "unit.campaign_many": "campaigns",
  "unit.channel_one": "channel",
  "unit.channel_few": "channels",
  "unit.channel_many": "channels",
  "unit.country_one": "country",
  "unit.country_few": "countries",
  "unit.country_many": "countries",
  "unit.product_one": "product in pipeline",
  "unit.product_few": "products in pipeline",
  "unit.product_many": "products in pipeline",
};

export type MessageKey = keyof typeof cs;
export const messages = { cs, en } satisfies Record<Locale, Record<MessageKey, string>>;

/** Replace {placeholder} tokens with values. */
export function format(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v !== undefined && v !== null ? String(v) : `{${k}}`;
  });
}

/**
 * Czech-style noun pluralization (1, 2-4, 5+). The key prefix is appended
 * with `_one`, `_few`, `_many` to look up the right form.
 */
export function pluralKey(n: number): "one" | "few" | "many" {
  if (n === 1) return "one";
  if (n >= 2 && n <= 4) return "few";
  return "many";
}
