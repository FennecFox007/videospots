// Translation dictionary. Keep keys flat (e.g. "timeline.tip") to avoid the
// nested-object dance — every key is just a string lookup, no interpolation
// runtime needed. Variables in messages use {name} placeholders, replaced
// by `format()` in the server/client t() implementations.
//
// Coverage policy:
//  - User-facing surfaces clients might see (timeline, detail, list, releases,
//    share, print, nav, sign-in, dialog text) → both CS and EN.
//  - Admin pages, edit/new forms → Czech only for now.
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
  "nav.releases": "Kalendář",
  "nav.list": "Plánované spoty",
  "nav.new": "+ Naplánovat",
  "nav.spots": "Video knihovna",
  "nav.templates": "Šablony nasazení",
  "nav.admin": "Admin",
  "nav.activity": "Aktivita",
  "nav.signout": "Odhlásit",
  "nav.search_hint": "Hledat",
  "nav.search_shortcut_tooltip":
    "Stiskni Ctrl+K (Cmd+K na macu) pro vyhledávání",

  // Activity feed (bell dropdown in nav)
  "activity_feed.title": "Aktivita",
  "activity_feed.empty": "Žádná aktivita.",
  "activity_feed.show_all": "Zobrazit kompletní audit log →",
  "activity_feed.unknown_user": "neznámý",
  "activity_feed.action.created": "vytvořil(a)",
  "activity_feed.action.updated": "upravil(a)",
  "activity_feed.action.deleted": "smazal(a)",
  "activity_feed.action.cancelled": "zrušil(a)",
  "activity_feed.action.approved": "schválil(a)",
  "activity_feed.action.archived": "archivoval(a)",
  "activity_feed.action.revoked": "deaktivoval(a)",
  "activity_feed.action.extended": "prodloužil(a)",

  // Saved views menu
  "saved_views.empty_state":
    "Zatím žádné uložené pohledy. Nastav filtry a klikni „Uložit aktuální\".",
  "saved_views.error_empty":
    "Není co uložit. Nejdřív nastav filtry (vyhledávání, stát, řetězec…).",
  "saved_views.prompt.title": "Pojmenovat pohled",
  "saved_views.prompt.message":
    "Pohled si zapamatuje aktuálně nastavené filtry.",
  "saved_views.prompt.placeholder": "např. CZ + SK aktivní",
  "saved_views.prompt.confirm": "Uložit",
  "saved_views.prompt.required": "Název nesmí být prázdný",
  "saved_views.toast.saved": "Pohled uložen",
  "saved_views.toast.save_failed": "Uložení pohledu selhalo",
  "saved_views.toast.deleted": "Pohled smazán",
  "saved_views.toast.delete_failed": "Smazání pohledu selhalo",
  "saved_views.delete.title": "Smazat pohled „{name}\"?",
  "saved_views.delete.message":
    "Tahle akce je nevratná. Filtry se nesmažou, jen jejich uložené pojmenování.",
  "saved_views.delete.confirm": "Smazat",
  "saved_views.delete.aria": "Smazat pohled {name}",
  "saved_views.delete.tooltip": "Smazat",
  "saved_views.payload.q": "hledání",
  "saved_views.payload.country": "stát",
  "saved_views.payload.chain": "řetězec",
  "saved_views.payload.runState": "stav",
  "saved_views.payload.approval": "schválení",
  "saved_views.payload.missingSpot": "bez spotu",
  "saved_views.payload.tag": "štítek",
  "saved_views.payload.from": "od",
  "saved_views.payload.to": "do",
  "saved_views.payload.empty": "(prázdné)",

  // Campaigns table aria-labels
  "campaigns_table.aria.select_all": "Vybrat vše",
  "campaigns_table.aria.select_one": "Vybrat {name}",
  "campaigns_table.aria.clear_selection": "Zrušit výběr",

  // Roles
  "roles.admin": "Admin",
  "roles.editor": "Editor",
  "roles.viewer": "Pouze čtení",

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
  "common.error": "Chyba",
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
  "timeline.density": "Hustota",
  "timeline.density.comfort": "Komfortní",
  "timeline.density.compact": "Kompaktní",
  "timeline.tip":
    "táhni za střed = posun, za okraj = délka, klik = otevřít detail, ▶ na baru = přehrát spot. Hlavičku s dny chytni a táhni pro posun v čase, shift+táhnout = snap na pondělí, dvojklik = skok na dnešek.",
  "timeline.share": "Sdílet",
  "timeline.print": "Tisk / PDF",
  "timeline.list_link": "Plánované spoty",
  // Plain text — the dashboard CTA renders a <Plus> icon next to it,
  // so leading "+" in the label would double-up visually.
  "timeline.new_campaign": "Naplánovat spot",
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
  "timeline.no_campaigns_in_range": "Zatím žádné spoty v tomto rozsahu.",
  "timeline.create_first": "Vytvoř první",
  "timeline.now_marker": "DNES",
  "timeline.bar_play": "Přehrát spot v novém panelu",
  "timeline.bar_no_spot": "Spot pro tuto zemi ještě nebyl přiřazen",
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
  "dashboard.running.empty_desc": "Žádný aktivní spot se právě teď nepřehrává.",
  "dashboard.running.title": "Právě běží",
  "dashboard.upcoming.empty_title": "Žádné naplánované",
  "dashboard.upcoming.empty_desc":
    "V příštích {days} dnech není naplánovaný žádný schválený spot.",
  "dashboard.upcoming.title": "Naplánováno na příštích {days} dní",
  "dashboard.ending.empty_title": "Žádný spot brzy nekončí",
  "dashboard.ending.empty_desc":
    "V příštích {days} dnech nekončí žádný běžící spot.",
  "dashboard.ending.title": "Konec do {days} dnů",
  "dashboard.stats.total_campaigns": "Celkem spotů",
  "dashboard.stats.this_month": "běží/poběží v {month}",
  "dashboard.stats.awaiting_approval": "Čeká na schválení",
  "dashboard.stats.awaiting_none": "Vše schváleno",
  "dashboard.stats.awaiting_split": "{running} už běží · {upcoming} v plánu",
  "dashboard.stats.awaiting_upcoming_only": "{upcoming} v plánu",
  "dashboard.stats.recent_activity": "Aktivita za 7 dní",
  "dashboard.stats.recent_activity_sub":
    "{campaigns} kampaní · {spots} spotů",
  "dashboard.in_days": "za {n} {unit}",
  "dashboard.today": "dnes",
  "dashboard.until": "do {date}",

  // Planned spots list (formerly "campaigns" — same data, renamed UI per
  // STAV.md Priority #2)
  "list.heading": "Plánované spoty",
  "list.export_csv": "Export CSV",
  "list.col.campaign": "Spot",
  "list.col.client": "Klient",
  "list.col.product": "Produkt",
  "list.col.start": "Začátek",
  "list.col.duration": "Délka",
  "list.col.channels": "Kanály",
  "list.col.status": "Stav",
  "list.col.tags": "Štítky",
  "list.empty.title": "Žádné spoty neodpovídají filtrům.",
  "list.empty.clear": "Vyčistit filtry",
  "list.bulk.cancel": "Zrušit (historicky)",
  "list.bulk.color": "Barva",
  "list.bulk.archive": "Archivovat",
  "list.bulk.selected": "vybráno",
  "list.tip":
    "Vyber spoty levým checkboxem; spodní lišta nabídne hromadné akce (smazat / zrušit / změnit barvu).",

  // Filter bar
  "filter.search_placeholder": "Hledat (název, klient, hra)…",
  "filter.all_countries": "Všechny státy",
  "filter.all_chains": "Všechny řetězce",
  "filter.all_states": "Všechny stavy",
  "filter.all_tags": "Všechny štítky",
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
  "detail.spot_pending":
    "Video ještě nebylo přiřazeno — spot je naplánovaný, video doplníš později.",
  "detail.assign_spots": "Přiřadit spoty",
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
  "releases.launch_campaign": "+ Launch spot",
  "releases.launch_campaign_tooltip":
    "Předvyplní formulář s tímhle produktem a launch oknem ±7 dní",
  "releases.status.released_days_ago": "Vyšlo před {n} {unit}",
  "releases.status.today": "Dnes!",
  "releases.status.in_days": "Za {n} {unit}",

  // Timeline context menu (right-click on bars / channels / country headers)
  "ctx.create_here": "+ Naplánovat spot zde ({chain}, od {date})",
  "ctx.create_for_country": "+ Spot pro celé {country}",
  "ctx.create_for_chain": "+ Nový spot pro {chain}",
  "ctx.filter_chain": "Filtrovat na {chain}",
  "ctx.filter_country": "Filtrovat na {country}",
  "ctx.open_detail": "Otevřít detail",
  "ctx.edit": "Upravit",
  "ctx.shift_week_back": "Posunout o týden ←",
  "ctx.shift_week_forward": "Posunout o týden →",
  "ctx.clone": "Klonovat",
  "ctx.cancel_historic": "Zrušit (historicky)",
  "ctx.reactivate": "Obnovit",
  "ctx.archive": "Archivovat",
  "ctx.collapse": "Sbalit",
  "ctx.expand": "Rozbalit",
  "ctx.focus_country": "Sbalit ostatní (zaměřit na tuto)",
  "ctx.edit_for_channel": "Upravit jen tento řetězec…",
  "ctx.approve": "Schvaluji",
  "ctx.unapprove": "Zrušit schválení",
  "ctx.share_link": "Sdílet odkaz (zkopíruje do schránky)",
  "ctx.share_for_approval_copied": "Odkaz zkopírován do schránky.",

  // Per-channel override dialog
  "override.title": "Upravit jen tento řetězec",
  "override.scope_note":
    "Tato změna se týká POUZE tohoto řetězce. Ostatní řetězce v plánu zůstanou beze změny.",
  "override.cancel_in_channel": "Vypnout spot v tomto řetězci",
  "override.master_dates": "Termín spotu jako celku",
  "override.clear": "Smazat přepsání",
  "override.saved": "Uloženo.",
  "override.cleared": "Přepsání zrušeno.",
  "override.error_end_before_start": "Konec nemůže být před začátkem.",
  "override.indicator_title":
    "Tento řetězec má vlastní termín odlišný od ostatních.",

  // Approval (auth-gated; share view is read-only)
  "approval.waiting": "Čeká na schválení",
  "approval.approved": "Schváleno",
  "approval.approved_on": "Schváleno {date}",
  "approval.approve": "Schvaluji",
  "approval.unapprove": "Zrušit schválení",
  "approval.approved_by": "Schválil(a) {who}",

  // Video library (formerly /spots renamed in UI per Phase 3 — DB still
  // calls them "spots" but in UI we say "Video knihovna" to disambiguate
  // from the planned-spot list)
  "spots.heading": "Video knihovna",
  "spots.subhead":
    "Knihovna všech video kreativ. Videa bez aktivního nasazení mají žluté upozornění.",
  "spots.new": "Nové video",
  "spots.tab.undeployed": "Nenasazené",
  "spots.tab.deployed": "Nasazené",
  "spots.tab.all": "Všechny",
  "spots.tab.archived": "Archiv",
  "spots.col.name": "Spot",
  "spots.col.product": "Produkt",
  "spots.col.country": "Země",
  "spots.col.status": "Status",
  "spots.col.deployments": "Nasazení",
  "spots.col.created": "Vytvořeno",
  "spots.empty.undeployed": "Žádné nenasazené spoty — všechno běží.",
  "spots.empty.generic": "Žádné spoty v této kategorii.",
  "spots.empty.filtered":
    "Žádný spot neodpovídá nastaveným filtrům. Zkus filtr uvolnit nebo Vymazat filtry.",
  "spots.filter.search_placeholder": "Hledat (název, produkt, URL)…",
  "spots.filter.all_products": "Všechny produkty",
  "spots.filter.sort.created": "Nejnovější",
  "spots.filter.sort.name": "Abecedně",
  "spots.filter.sort.deployments": "Podle nasazení",
  "spots.filter.group.country": "Po zemích",
  "spots.filter.group.country_tooltip":
    "Skupiny podle země — výchozí pro velkou knihovnu.",
  "spots.filter.group.flat": "Plochý seznam",
  "spots.filter.group.flat_tooltip":
    "Bez seskupení — jeden seznam podle aktivního řazení.",
  "spots.filter.approval.all": "Všechny stavy",
  "spots.filter.approval.pending": "Čeká",
  "spots.filter.approval.approved": "Schváleno",
  "spots.col.approval": "Schválení",

  // Two independent state axes — production (manual, agency-controlled)
  // and approval (derived from clientApprovedAt, Sony-controlled). Plus
  // three derived deployment-time states. See lib/spot-status.ts.
  // Production axis:
  "spot_status.bez_zadani": "Bez zadání",
  "spot_status.zadan": "Zadán",
  "spot_status.ve_vyrobe": "Ve výrobě",
  // Approval axis:
  "spot_status.ceka_na_schvaleni": "Čeká na schválení",
  "spot_status.schvaleno": "Schváleno",
  // Derived deployment-time:
  "spot_status.naplanovan": "Naplánován",
  "spot_status.bezi": "Běží",
  "spot_status.skoncil": "Skončil",
  "spots.status.section.title": "Stav",
  "spots.status.section.production": "Stav výroby",
  "spots.status.section.approval": "Schválení",
  "spots.status.toast.changed": "Stav výroby změněn",
  "spots.status.tooltip.approve_via_prompt":
    "Schvalování zaznamená kdo a kdy — otevře se prompt na poznámku.",

  // Spot approval workflow — legacy two-state labels (Phase 3 migrates
  // call sites to the unified spot_status.* namespace above).
  "spots.approval.status.pending": "Čeká",
  "spots.approval.status.approved": "Schváleno",
  "spots.approval.approve_button": "Schválit",
  "spots.approval.clear_button": "Zrušit schválení",
  "spots.approval.approve_prompt.title": "Schválit spot",
  "spots.approval.approve_prompt.message":
    "Schvaluji tento spot. Volitelně přidej poznámku.",
  "spots.approval.approve_prompt.placeholder":
    "např. Schváleno e-mailem od Honzy 12. 5.",
  "spots.approval.clear_confirm.title": "Zrušit schválení?",
  "spots.approval.clear_confirm.message":
    "Spot se vrátí do stavu „Čeká na schválení\". Historie se v audit logu zachová.",
  "spots.approval.toast.approved": "Spot schválen",
  "spots.approval.toast.cleared": "Schválení zrušeno — spot čeká",
  "spots.approval.approved_by": "Schválil(a) {who}",
  "spots.approval.no_comment": "(bez poznámky)",
  "spots.approval.section.title": "Schválení",

  // Spot detail richer view
  "spots.deployment_history.title": "Historie nasazení",
  "spots.deployment_history.empty": "Video zatím nikdy nebylo nasazeno.",
  "spots.audit.title": "Aktivita",
  "spots.audit.empty": "Žádná zaznamenaná aktivita.",

  // Spot picker warnings (in spot/plan create form)
  "spot_picker.warning.pending":
    "⚠️ Tato kreativa ještě nebyla klientem schválena.",
  "spots.undeployed_label": "Nenasazené",
  "spots.archived_at": "Archivováno {date}",
  "spots.play": "Přehrát",
  "spots.back_to_list": "Zpět na seznam",
  "spots.section.preview": "Náhled",
  "spots.section.deployments": "Aktivní nasazení",
  "spots.deployments.empty":
    "Tato kreativa zatím není v žádném aktivním nasazení.",
  "spots.action.archive": "Archivovat",
  "spots.action.archive_tooltip":
    "Skryje kreativu z výchozího seznamu. Historie nasazení zůstane.",
  "spots.action.unarchive": "Obnovit z archivu",
  "spots.action.delete": "Smazat trvale",
  "spots.action.delete_tooltip":
    "Funguje jen pokud kreativa není v žádném nasazení.",
  "spots.form.heading_new": "Nový spot",
  "spots.form.subhead_new":
    "Zaregistrovat video creative pro pozdější použití v kampaních.",
  "spots.form.section.basics": "Základní údaje",
  "spots.form.section.product": "Produkt",
  "spots.form.section.where": "Země",
  "spots.form.section.video": "Video",
  "spots.form.field.name": "Název spotu",
  "spots.form.field.name_placeholder": "např. Saros Launch CZ",
  "spots.form.field.name_hint":
    "Volitelné. Když nevyplníš, doplní se automaticky podle produktu a země.",
  "spots.form.field.product_name": "Produkt",
  "spots.form.field.product_kind": "Typ",
  "spots.form.field.product_placeholder": "např. Saros",
  "spots.form.field.product_hint":
    "Pokud produkt zatím neexistuje, vytvoří se automaticky.",
  "spots.form.field.country": "Země",
  "spots.form.field.video_url": "URL videa",
  "spots.form.field.video_placeholder": "https://www.youtube.com/watch?v=…",
  "spots.form.submit_create": "Vytvořit spot",
  "spots.form.submit_save": "Uložit změny",
  "spots.form.modal.title": "Nový spot",
  "spots.form.modal.submit": "Vytvořit a vybrat",
  "spots.form.modal.error_url_required": "Doplň URL videa.",
  "spots.form.modal.error_url_invalid":
    "URL nevypadá správně. Zkus to znovu.",

  // Dashboard: undeployed creatives tile
  "dashboard.stats.undeployed_spots": "Video bez nasazení",
  "dashboard.stats.undeployed_none": "Vše nasazené",
  "dashboard.stats.undeployed_sub": "vyrobených, ale nezařazených",
  "filter.approval.all": "Schválení",
  "filter.approval.pending": "Čeká na schválení",
  "filter.approval.approved": "Schváleno",
  "filter.missing_spot.label": "Bez videa",
  "filter.missing_spot.tooltip":
    "Plánované spoty, kde alespoň jedna země ještě nemá přiřazenou kreativu.",

  // Video library drawer (toolbar button on /, slide-out panel).
  // Quick drag-onto-timeline surface, distinct from the full /spots admin
  // page. Both surface the same DB rows, just different layout/affordances.
  "spots_drawer.button": "Knihovna",
  "spots_drawer.button_tooltip":
    "Otevřít video knihovnu. Můžeš video přetáhnout na timeline a naplánovat z něj spot.",
  "spots_drawer.aria_label": "Video knihovna",
  "spots_drawer.heading": "Video knihovna",
  "spots_drawer.hint": "Přetáhni video na timeline pro naplánování spotu.",
  "spots_drawer.search_placeholder": "Hledat…",
  "spots_drawer.tab.undeployed": "Nenasazené",
  "spots_drawer.tab.all": "Všechny",
  "spots_drawer.empty.undeployed": "Žádná nenasazená videa.",
  "spots_drawer.empty.all": "Knihovna je prázdná.",
  "spots_drawer.undeployed": "Nenasazené",
  "spots_drawer.undeployed_count": "{count} nenasazených",
  "spots_drawer.card_drag_hint": "Přetáhni na timeline",
  "spots_drawer.footer_hint": "Přetáhni video na řádek kanálu",
  "spots_drawer.new_link": "+ Nové video",
  "spots_drawer.action.play": "Přehrát",
  "spots_drawer.action.edit": "Upravit",

  // Spot drop modal — opens after dragging a video onto a channel row.
  // (Creates a planned spot with this video already attached for the
  // matching country.)
  "spot_drop.title": "Naplánovat spot z videa",
  "spot_drop.field.name": "Název spotu",
  "spot_drop.field.channels": "Kanály",
  "spot_drop.field.channels_hint":
    "Přetáhnutý kanál je vybraný. Můžeš přidat další kanály ve stejné zemi.",
  "spot_drop.dropped_here": "drop",
  "spot_drop.approve_now": "Schválit hned",
  "spot_drop.submit": "Naplánovat spot",
  "spot_drop.created": "Spot naplánovaný.",
  "spot_drop.country_mismatch":
    "Video je pro {spot}, drop byl na {target}. Každé video patří jedné zemi.",
  "spot_drop.error_name": "Vyplň název spotu.",
  "spot_drop.error_no_channels": "Vyber alespoň jeden kanál.",
  "spot_drop.error_end_before_start": "Konec nemůže být před začátkem.",

  // Planned spot form (new + edit) — formerly the "campaign form"
  "form.section.basic": "Základní údaje",
  "form.section.product": "Produkt",
  "form.section.video": "Videa (jedno per země)",
  "form.section.video_hint":
    "Vyber video z knihovny pro každou zemi. Pokud potřebné video ještě nemáš, klikni na „+ Nové video“ — otevře se ve vedlejší záložce, po vytvoření obnov tuto stránku.",
  "form.section.term": "Termín",
  "form.section.channels": "Kanály",
  "form.section.channels_hint":
    "Vyber kombinace stát × řetězec, kde má spot běžet. Hromadný výběr přes tlačítka, jednotlivé pak jen klikni.",
  "form.section.notes": "Poznámky",
  "form.section.recurring": "Opakovat (volitelné)",
  "form.section.recurring_hint":
    "Vytvoří víc plánovaných spotů najednou s posunutými termíny. Vhodné pro pravidelné nasazení.",
  "form.section.product_hint":
    "Co spot propaguje — hra, konzole, ovladač, příslušenství… Volitelné, ale pomáhá při třídění.",
  "form.field.name": "Název spotu",
  "form.field.name_placeholder": "např. Saros — launch trailer",
  "form.field.client": "Klient",
  "form.field.comm_type": "Typ komunikace",
  "form.field.comm_type_hint":
    "Co přesně tenhle spot dělá vůči vydání produktu",
  "form.field.tags": "Štítky",
  "form.field.tags_hint": "Odděl čárkou: „priorita, jaro, …“",
  "form.field.tags_placeholder": "priorita, sezóna, …",
  "form.field.color": "Barva v timeline",
  "form.field.product_name": "Název produktu",
  "form.field.product_name_placeholder":
    "např. Saros, PS5 Slim, DualSense Edge…",
  "form.field.product_kind": "Druh",
  "form.field.product_release_date": "Datum vydání",
  "form.field.product_release_date_hint": "Volitelné, hodí se pro launchy",
  "form.field.product_cover_url": "Obrázek (URL)",
  "form.field.product_cover_url_hint": "Cover, packshot, render…",
  "form.field.product_summary": "Stručný popis",
  "form.field.product_summary_placeholder": "krátká věta o produktu",
  "form.field.starts_at": "Začátek",
  "form.field.ends_at": "Konec",
  "form.field.notes_placeholder":
    "cokoli užitečného (interní info, briefing…)",
  "form.recurring.toggle": "Vytvořit sérii spotů",
  "form.recurring.frequency": "Frekvence",
  "form.recurring.freq_daily": "každý den",
  "form.recurring.freq_weekly": "každý týden",
  "form.recurring.freq_biweekly": "každé 2 týdny",
  "form.recurring.freq_monthly": "každé 4 týdny",
  "form.recurring.count": "Počet spotů",
  "form.recurring.note":
    "Každý další spot bude pojmenovaný „Název (n/N)“. Výběr kanálů a produkt se zachovají u všech.",
  "form.video.placeholder": "YouTube / Vimeo / přímý mp4 odkaz",
  "form.video.no_spot": "— žádné video —",
  "form.video.new_spot": "+ Nové video",
  "form.video.new_spot_tooltip":
    "Otevře video knihovnu v nové záložce. Po vytvoření obnov tuto stránku.",
  "form.submit_create": "Naplánovat spot",
  "form.submit_save": "Uložit změny",
  "form.cancel": "Zrušit",
  "form.new_campaign_title": "Naplánovat spot",
  "form.edit_campaign_title": "Upravit spot",
  "form.hint_default":
    "Naplánuj video na vybrané kanály v zadaném období.",
  "form.hint_template": "Předvyplněno ze šablony „{name}“.",
  "form.hint_release": "Předvyplněno z release kalendáře pro produkt „{name}“.",
  "form.hint_timeline": "Předvyplněno z timeline (kanály a termín).",

  // Channels picker
  "picker.selected": "Vybráno",
  "picker.deselect_all": "Odznačit vše",
  "picker.select_all": "Vybrat vše",
  "picker.country_select_all": "Vše v {country}",
  "picker.country_deselect_all": "Žádný v {country}",

  // Find-slot
  "findslot.heading": "Najít volný termín",
  "findslot.subtitle":
    "Vyber kanály a požadovanou délku — najdu nejbližší volné období, kde se na žádném vybraném kanálu nepřekrývá schválený spot. Hledá se {days} dní dopředu.",
  "findslot.field.duration": "Délka spotu (dní)",
  "findslot.field.from": "Hledat od",
  "findslot.field.channels": "Kanály",
  "findslot.find": "Najít volný termín",
  "findslot.results.heading": "Výsledky (top {n})",
  "findslot.results.none_found": "Nenalezeno",
  "findslot.results.empty":
    "V příštích {days} dnech není volný {duration}denní úsek napříč všemi vybranými kanály. Zkus kratší dobu nebo méně kanálů.",
  "findslot.busy_intervals": "{n} obsazených intervalů",
  "findslot.create_here": "Vytvořit zde →",
  "findslot.in_n_days": "za {n} {unit}",

  // Admin
  "admin.heading": "Administrace",
  "admin.tab.countries": "Státy",
  "admin.tab.chains": "Řetězce",
  "admin.tab.channels": "Kanály (matice)",
  "admin.tab.products": "Produkty",
  "admin.tab.users": "Uživatelé",
  "admin.tab.templates": "Šablony",
  "admin.tab.share_links": "Sdílené odkazy",
  "admin.tab.import": "Import CSV",
  "admin.tab.archive": "Archiv",
  "admin.tab.audit": "Audit log",
  "admin.share_links.description":
    "Všechny veřejné odkazy vytvořené v systému. Aktivní = klient ho právě může otevřít. Expirované = doběhla doba platnosti. Deaktivované = editor je zrušil ručně před expirací.",
  "admin.share_links.filter.active": "Aktivní",
  "admin.share_links.filter.expired": "Expirované",
  "admin.share_links.filter.revoked": "Deaktivované",
  "admin.share_links.filter.all": "Všechny",
  "admin.share_links.empty.title": "Žádné odkazy",
  "admin.share_links.empty.description":
    "V této kategorii zatím není žádný sdílený odkaz.",
  "admin.share_links.col.status": "Stav",
  "admin.share_links.col.target": "Cíl",
  "admin.share_links.col.label": "Štítek",
  "admin.share_links.col.created": "Vytvořeno",
  "admin.share_links.col.expires": "Platnost",
  "admin.share_links.col.actions": "Akce",
  "admin.share_links.target_timeline": "Timeline",
  "admin.share_links.campaign_unnamed": "Spot #{id}",
  "admin.share_links.campaign_deleted": "(spot odstraněn)",
  "admin.card.countries.desc":
    "Trhy, kde nasazujeme spoty. CZ, SK, HU, PL — přidat lze libovolný.",
  "admin.card.chains.desc":
    "Maloobchodní brandy s našimi zobrazovači — Datart, Alza, MediaMarkt…",
  "admin.card.channels.desc":
    "Matice Stát × Řetězec. Označ které kombinace skutečně existují.",
  "admin.card.products.desc":
    "Hry, konzole, ovladače, příslušenství… s daty vydání a covery. Spoty se na ně mapují.",
  "admin.card.users.desc":
    "Přidávej, mažeš, nastavuješ hesla členům týmu.",
  "admin.card.templates.desc":
    "Uložené konfigurace nasazení (klient, barva, kanály, štítky, délka) pro rychlé opakování.",
  "admin.card.import.desc":
    "Hromadný import plánovaných spotů z CSV (migrace z Excelu).",
  "admin.card.archive.desc":
    "Archivované spoty. Lze obnovit zpět, nebo definitivně smazat.",
  "admin.card.audit.desc":
    "Co kdo kdy udělal — kompletní historie akcí.",

  // Save buttons / share / template
  "share_button.label": "Sdílet",
  "share_button.generating": "Generuji…",
  "share_button.copy": "Kopírovat",
  "share_button.copied": "✓ Zkopírováno",
  "share_button.note":
    "Kdokoli s odkazem uvidí spot bez přihlášení. Spravovat odkazy můžeš níže.",
  "share_button.expires_30d": "Vytvořit odkaz (30 dní)",
  "share_button.revoke_confirm_inline": "Opravdu deaktivovat tento odkaz?",
  "share_form.expiry_label": "Platnost",
  "share_form.expiry_n_days": "{n} dní",
  "share_form.label_label": "Štítek",
  "share_form.label_optional": "volitelný",
  "share_form.label_placeholder": "např. Pre-launch preview pro Maňáska",
  "share_form.create": "Vytvořit",
  "timeline_share.label": "Sdílet timeline",
  "timeline_share.title":
    "Vytvořit veřejný odkaz na aktuálně viditelnou timeline",
  "timeline_share.note":
    "Klient uvidí celou timeline ve stejném rozsahu a s aplikovanými filtry, bez přihlášení a bez editačních tlačítek.",
  "share_links.section_title": "Sdílené odkazy",
  "share_links.empty": "Tento spot zatím nemá žádný sdílený odkaz.",
  "share_links.no_active":
    "Žádný aktivní odkaz. Klikni na „Sdílet“ pro vytvoření.",
  "share_links.show_inactive": "Zobrazit neaktivní ({n})",
  "share_links.status.active": "Aktivní",
  "share_links.status.expired": "Expirovaný",
  "share_links.status.revoked": "Deaktivovaný",
  "share_links.expires_at": "platnost do {date}",
  "share_links.expired_at": "expiroval {date}",
  "share_links.revoked_at": "deaktivoval {by} {date}",
  "share_links.no_expiry": "bez expirace",
  "share_links.created_at": "vytvořil {by} · {date}",
  "share_links.revoke_confirm":
    "Opravdu deaktivovat tento odkaz? Klient s ním ztratí přístup okamžitě.",
  "share_links.action.copy": "Kopírovat",
  "share_links.action.extend": "Prodloužit",
  "share_links.action.extend_tooltip": "Prodloužit platnost o 30 dní",
  "share_links.action.revoke": "Deaktivovat",
  "save_template.label": "Uložit jako šablonu",
  "save_template.prompt_title": "Pojmenovat šablonu",
  "save_template.prompt_message":
    "Šablona si zapamatuje typ komunikace, barvu, štítky, kanály a délku.",
  "save_template.placeholder": "např. Launch CZ/SK",
  "save_template.confirm": "Uložit",
  "save_template.success": "Šablona uložena",
  "editable_title.save": "Uložit",
  "editable_title.cancel": "Zrušit",
  "editable_title.empty_error": "Název nesmí být prázdný",
  "editable_title.saving": "ukládám…",
  "editable_title.tooltip": "Dvojklik pro přejmenování",
  "editable_title.rename": "Přejmenovat",

  // Share view
  "share.preview_campaign": "Veřejný náhled spotu",
  "share.preview_timeline": "Veřejný náhled timeline",
  "share.expires": "Tento odkaz je platný do {date}.",
  "share.open_app": "Otevřít aplikaci",
  "share.plan_heading": "Plánované spoty",

  // Print
  "print.subheading": "rozpis spotu",
  "print.subheading_timeline": "rozpis spotů",
  "print.created": "Vytvořeno {date}",
  "print.generated": "Generováno {date}",
  "print.scan_video": "Otevřít video",
  "print.scan_campaign": "Otevřít spot",
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
  "unit.campaign_one": "spot",
  "unit.campaign_few": "spoty",
  "unit.campaign_many": "spotů",
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
  "nav.releases": "Calendar",
  "nav.list": "Planned spots",
  "nav.new": "+ Plan",
  "nav.spots": "Video library",
  "nav.templates": "Deployment templates",
  "nav.admin": "Admin",
  "nav.activity": "Activity",
  "nav.signout": "Sign out",
  "nav.search_hint": "Search",
  "nav.search_shortcut_tooltip":
    "Press Ctrl+K (Cmd+K on Mac) to search",

  // Activity feed (bell dropdown in nav)
  "activity_feed.title": "Activity",
  "activity_feed.empty": "No activity yet.",
  "activity_feed.show_all": "Show full audit log →",
  "activity_feed.unknown_user": "unknown",
  "activity_feed.action.created": "created",
  "activity_feed.action.updated": "updated",
  "activity_feed.action.deleted": "deleted",
  "activity_feed.action.cancelled": "cancelled",
  "activity_feed.action.approved": "approved",
  "activity_feed.action.archived": "archived",
  "activity_feed.action.revoked": "revoked",
  "activity_feed.action.extended": "extended",

  // Saved views menu
  "saved_views.empty_state":
    "No saved views yet. Set up filters and click \"Save current\".",
  "saved_views.error_empty":
    "Nothing to save. Set up some filters first (search, country, retailer…).",
  "saved_views.prompt.title": "Name the view",
  "saved_views.prompt.message":
    "The view will remember the currently active filter set.",
  "saved_views.prompt.placeholder": "e.g. CZ + SK active",
  "saved_views.prompt.confirm": "Save",
  "saved_views.prompt.required": "Name can't be empty",
  "saved_views.toast.saved": "View saved",
  "saved_views.toast.save_failed": "Saving the view failed",
  "saved_views.toast.deleted": "View deleted",
  "saved_views.toast.delete_failed": "Deleting the view failed",
  "saved_views.delete.title": "Delete view \"{name}\"?",
  "saved_views.delete.message":
    "This is irreversible. The filters themselves are kept — only the saved label is removed.",
  "saved_views.delete.confirm": "Delete",
  "saved_views.delete.aria": "Delete view {name}",
  "saved_views.delete.tooltip": "Delete",
  "saved_views.payload.q": "search",
  "saved_views.payload.country": "country",
  "saved_views.payload.chain": "retailer",
  "saved_views.payload.runState": "state",
  "saved_views.payload.approval": "approval",
  "saved_views.payload.missingSpot": "missing spot",
  "saved_views.payload.tag": "tag",
  "saved_views.payload.from": "from",
  "saved_views.payload.to": "to",
  "saved_views.payload.empty": "(empty)",

  // Campaigns table aria-labels
  "campaigns_table.aria.select_all": "Select all",
  "campaigns_table.aria.select_one": "Select {name}",
  "campaigns_table.aria.clear_selection": "Clear selection",

  // Roles
  "roles.admin": "Admin",
  "roles.editor": "Editor",
  "roles.viewer": "Read-only",

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
  "common.error": "Error",
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
  "timeline.density": "Density",
  "timeline.density.comfort": "Comfort",
  "timeline.density.compact": "Compact",
  "timeline.tip":
    "drag the middle = move, drag the edge = resize, click = open detail, ▶ on bar = play the spot. Grab the days header to scrub through time, shift+drag = snap to Monday, double-click = jump to today.",
  "timeline.share": "Share",
  "timeline.print": "Print / PDF",
  "timeline.list_link": "Planned spots",
  // Plain text — the dashboard CTA renders a <Plus> icon next to it,
  // so leading "+" in the label would double-up visually.
  "timeline.new_campaign": "Plan a spot",
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
  "timeline.no_campaigns_in_range": "No spots in this range yet.",
  "timeline.create_first": "Create the first one",
  "timeline.now_marker": "NOW",
  "timeline.bar_play": "Play the spot in a new tab",
  "timeline.bar_no_spot": "No spot assigned for this country yet",
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
  "dashboard.running.empty_desc": "No active spot is currently playing.",
  "dashboard.running.title": "Running now",
  "dashboard.upcoming.empty_title": "Nothing scheduled",
  "dashboard.upcoming.empty_desc":
    "No approved spot is scheduled for the next {days} days.",
  "dashboard.upcoming.title": "Scheduled in next {days} days",
  "dashboard.ending.empty_title": "Nothing ending soon",
  "dashboard.ending.empty_desc":
    "No running spot ends in the next {days} days.",
  "dashboard.ending.title": "Ending within {days} days",
  "dashboard.stats.total_campaigns": "Total spots",
  "dashboard.stats.this_month": "running in {month}",
  "dashboard.stats.awaiting_approval": "Awaiting approval",
  "dashboard.stats.awaiting_none": "All approved",
  "dashboard.stats.awaiting_split": "{running} running · {upcoming} upcoming",
  "dashboard.stats.awaiting_upcoming_only": "{upcoming} upcoming",
  "dashboard.stats.recent_activity": "Activity (7 days)",
  "dashboard.stats.recent_activity_sub":
    "{campaigns} campaigns · {spots} spots",
  "dashboard.in_days": "in {n} {unit}",
  "dashboard.today": "today",
  "dashboard.until": "until {date}",

  // Planned spots list (formerly "campaigns" — same data, renamed UI per
  // STAV.md Priority #2)
  "list.heading": "Planned spots",
  "list.export_csv": "Export CSV",
  "list.col.campaign": "Spot",
  "list.col.client": "Client",
  "list.col.product": "Product",
  "list.col.start": "Start",
  "list.col.duration": "Duration",
  "list.col.channels": "Channels",
  "list.col.status": "Status",
  "list.col.tags": "Tags",
  "list.empty.title": "No spots match the filters.",
  "list.empty.clear": "Clear filters",
  "list.bulk.cancel": "Cancel (historic)",
  "list.bulk.color": "Color",
  "list.bulk.archive": "Archive",
  "list.bulk.selected": "selected",
  "list.tip":
    "Pick spots with the left checkbox; a bulk action bar appears at the bottom (delete / cancel / change color).",

  // Filter bar
  "filter.search_placeholder": "Search (name, client, product)…",
  "filter.all_countries": "All countries",
  "filter.all_chains": "All retailers",
  "filter.all_states": "All states",
  "filter.all_tags": "All tags",
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
  "detail.spot_pending":
    "No video assigned yet — the spot is scheduled, attach a video later.",
  "detail.assign_spots": "Assign spots",
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
  "releases.launch_campaign": "+ Launch spot",
  "releases.launch_campaign_tooltip":
    "Pre-fills the form with this product and a ±7-day launch window",
  "releases.status.released_days_ago": "Released {n} {unit} ago",
  "releases.status.today": "Today!",
  "releases.status.in_days": "In {n} {unit}",

  // Timeline context menu
  "ctx.create_here": "+ Plan a spot here ({chain}, from {date})",
  "ctx.create_for_country": "+ Plan a spot for all of {country}",
  "ctx.create_for_chain": "+ Plan a spot for {chain}",
  "ctx.filter_chain": "Filter by {chain}",
  "ctx.filter_country": "Filter by {country}",
  "ctx.open_detail": "Open detail",
  "ctx.edit": "Edit",
  "ctx.shift_week_back": "Shift one week ←",
  "ctx.shift_week_forward": "Shift one week →",
  "ctx.clone": "Duplicate",
  "ctx.cancel_historic": "Cancel (historic)",
  "ctx.reactivate": "Reactivate",
  "ctx.archive": "Archive",
  "ctx.collapse": "Collapse",
  "ctx.expand": "Expand",
  "ctx.focus_country": "Collapse others (focus this one)",
  "ctx.edit_for_channel": "Edit only this retailer…",
  "ctx.approve": "Approve",
  "ctx.unapprove": "Clear approval",
  "ctx.share_link": "Share link (copies to clipboard)",
  "ctx.share_for_approval_copied": "Link copied to clipboard.",

  // Per-channel override dialog
  "override.title": "Edit only this retailer",
  "override.scope_note":
    "This change applies ONLY to this retailer. Other retailers in the plan stay unchanged.",
  "override.cancel_in_channel": "Turn the spot off in this retailer",
  "override.master_dates": "Spot-wide dates",
  "override.clear": "Clear override",
  "override.saved": "Saved.",
  "override.cleared": "Override cleared.",
  "override.error_end_before_start": "End cannot be before start.",
  "override.indicator_title":
    "This retailer has its own schedule, different from the others.",

  // Approval (auth-gated; share view is read-only)
  "approval.waiting": "Waiting for approval",
  "approval.approved": "Approved",
  "approval.approved_on": "Approved {date}",
  "approval.approve": "Approve",
  "approval.unapprove": "Clear approval",
  "approval.approved_by": "Approved by {who}",

  // Video library (formerly /spots renamed in UI per Phase 3 — DB still
  // calls them "spots" but in UI we say "Video library" to disambiguate
  // from the planned-spot list)
  "spots.heading": "Video library",
  "spots.subhead":
    "Library of every video creative. Videos not currently deployed get an amber heads-up.",
  "spots.new": "New video",
  "spots.tab.undeployed": "Undeployed",
  "spots.tab.deployed": "Deployed",
  "spots.tab.all": "All",
  "spots.tab.archived": "Archive",
  "spots.col.name": "Spot",
  "spots.col.product": "Product",
  "spots.col.country": "Country",
  "spots.col.status": "Status",
  "spots.col.deployments": "Deployment",
  "spots.col.created": "Created",
  "spots.empty.undeployed": "No undeployed spots — everything's scheduled.",
  "spots.empty.generic": "No spots in this view.",
  "spots.empty.filtered":
    "No spot matches the current filters. Try relaxing them or click Clear filters.",
  "spots.filter.search_placeholder": "Search (name, product, URL)…",
  "spots.filter.all_products": "All products",
  "spots.filter.sort.created": "Newest first",
  "spots.filter.sort.name": "By name",
  "spots.filter.sort.deployments": "By deployments",
  "spots.filter.group.country": "Group by country",
  "spots.filter.group.country_tooltip":
    "Sections per country — default for a large library.",
  "spots.filter.group.flat": "Flat list",
  "spots.filter.group.flat_tooltip":
    "No grouping — single list ordered by the active sort.",
  "spots.filter.approval.all": "All states",
  "spots.filter.approval.pending": "Pending",
  "spots.filter.approval.approved": "Approved",
  "spots.col.approval": "Approval",

  // Two-axis state set — see CS comment above for the rationale.
  "spot_status.bez_zadani": "No brief",
  "spot_status.zadan": "Briefed",
  "spot_status.ve_vyrobe": "In production",
  "spot_status.ceka_na_schvaleni": "Awaiting approval",
  "spot_status.schvaleno": "Approved",
  "spot_status.naplanovan": "Scheduled",
  "spot_status.bezi": "Running",
  "spot_status.skoncil": "Ended",
  "spots.status.section.title": "Status",
  "spots.status.section.production": "Production status",
  "spots.status.section.approval": "Approval",
  "spots.status.toast.changed": "Production status updated",
  "spots.status.tooltip.approve_via_prompt":
    "Approval records who and when — opens a note prompt.",

  // Spot approval workflow — legacy two-state labels (Phase 3 migrates
  // call sites to the unified spot_status.* namespace above).
  "spots.approval.status.pending": "Pending",
  "spots.approval.status.approved": "Approved",
  "spots.approval.approve_button": "Approve",
  "spots.approval.clear_button": "Unapprove",
  "spots.approval.approve_prompt.title": "Approve spot",
  "spots.approval.approve_prompt.message":
    "I approve this spot. Optionally add a note.",
  "spots.approval.approve_prompt.placeholder":
    "e.g. Approved via email from John on May 12",
  "spots.approval.clear_confirm.title": "Unapprove this spot?",
  "spots.approval.clear_confirm.message":
    "The spot returns to \"Pending approval\". History stays in the audit log.",
  "spots.approval.toast.approved": "Spot approved",
  "spots.approval.toast.cleared": "Approval cleared — spot pending",
  "spots.approval.approved_by": "Approved by {who}",
  "spots.approval.no_comment": "(no note)",
  "spots.approval.section.title": "Approval",

  // Spot detail richer view
  "spots.deployment_history.title": "Deployment history",
  "spots.deployment_history.empty": "Never been deployed yet.",
  "spots.audit.title": "Activity",
  "spots.audit.empty": "No recorded activity.",

  // Spot picker warnings (in spot/plan create form)
  "spot_picker.warning.pending":
    "⚠️ This creative hasn't been client-approved yet.",
  "spots.undeployed_label": "Undeployed",
  "spots.archived_at": "Archived {date}",
  "spots.play": "Play",
  "spots.back_to_list": "Back to list",
  "spots.section.preview": "Preview",
  "spots.section.deployments": "Active deployments",
  "spots.deployments.empty":
    "This creative isn't currently in any active deployment.",
  "spots.action.archive": "Archive",
  "spots.action.archive_tooltip":
    "Hides the creative from default lists. Deployment history stays intact.",
  "spots.action.unarchive": "Restore from archive",
  "spots.action.delete": "Delete permanently",
  "spots.action.delete_tooltip":
    "Only works if the creative isn't in any deployment.",
  "spots.form.heading_new": "New video",
  "spots.form.subhead_new":
    "Register a video creative for later deployment.",
  "spots.form.section.basics": "Basics",
  "spots.form.section.product": "Product",
  "spots.form.section.where": "Country",
  "spots.form.section.video": "Video",
  "spots.form.field.name": "Spot name",
  "spots.form.field.name_placeholder": "e.g. Saros Launch CZ",
  "spots.form.field.name_hint":
    "Optional. Defaults to product + country when left blank.",
  "spots.form.field.product_name": "Product",
  "spots.form.field.product_kind": "Type",
  "spots.form.field.product_placeholder": "e.g. Saros",
  "spots.form.field.product_hint":
    "If the product doesn't exist yet, it'll be created automatically.",
  "spots.form.field.country": "Country",
  "spots.form.field.video_url": "Video URL",
  "spots.form.field.video_placeholder": "https://www.youtube.com/watch?v=…",
  "spots.form.submit_create": "Create spot",
  "spots.form.submit_save": "Save changes",
  "spots.form.modal.title": "New spot",
  "spots.form.modal.submit": "Create and select",
  "spots.form.modal.error_url_required": "Fill in the video URL.",
  "spots.form.modal.error_url_invalid":
    "That URL doesn't look right. Try again.",

  // Dashboard: undeployed creatives tile
  "dashboard.stats.undeployed_spots": "Videos without deployment",
  "dashboard.stats.undeployed_none": "All deployed",
  "dashboard.stats.undeployed_sub": "produced but unused",
  "filter.approval.all": "Approval",
  "filter.approval.pending": "Awaiting approval",
  "filter.approval.approved": "Approved",
  "filter.missing_spot.label": "Missing video",
  "filter.missing_spot.tooltip":
    "Planned spots with at least one country still waiting for a creative.",

  // Video library drawer — quick drag-onto-timeline surface
  "spots_drawer.button": "Library",
  "spots_drawer.button_tooltip":
    "Open the video library. Drag a video onto the timeline to plan a spot from it.",
  "spots_drawer.aria_label": "Video library",
  "spots_drawer.heading": "Video library",
  "spots_drawer.hint": "Drag a video onto the timeline to plan a spot.",
  "spots_drawer.search_placeholder": "Search…",
  "spots_drawer.tab.undeployed": "Undeployed",
  "spots_drawer.tab.all": "All",
  "spots_drawer.empty.undeployed": "No undeployed videos.",
  "spots_drawer.empty.all": "Library is empty.",
  "spots_drawer.undeployed": "Undeployed",
  "spots_drawer.undeployed_count": "{count} undeployed",
  "spots_drawer.card_drag_hint": "Drag onto the timeline",
  "spots_drawer.footer_hint": "Drop a video onto a channel row",
  "spots_drawer.new_link": "+ New video",
  "spots_drawer.action.play": "Play",
  "spots_drawer.action.edit": "Edit",

  // Spot drop modal — opens after dragging a video onto a channel row.
  // Creates a planned spot with this video already attached for the
  // matching country.
  "spot_drop.title": "Plan a spot from this video",
  "spot_drop.field.name": "Spot name",
  "spot_drop.field.channels": "Retailers",
  "spot_drop.field.channels_hint":
    "The retailer you dropped on is selected. Add other retailers in the same country if you want.",
  "spot_drop.dropped_here": "drop",
  "spot_drop.approve_now": "Approve now",
  "spot_drop.submit": "Plan the spot",
  "spot_drop.created": "Spot planned.",
  "spot_drop.country_mismatch":
    "Video is for {spot}, dropped on {target}. Each video is country-bound.",
  "spot_drop.error_name": "Fill in the spot name.",
  "spot_drop.error_no_channels": "Pick at least one retailer.",
  "spot_drop.error_end_before_start": "End cannot be before start.",

  // Planned spot form (new + edit) — formerly "campaign form"
  "form.section.basic": "Basics",
  "form.section.product": "Product",
  "form.section.video": "Videos (one per country)",
  "form.section.video_hint":
    "Pick a video from the library for each country. If the one you need doesn't exist yet, click \"+ New video\" — it opens in another tab; reload this page after creating.",
  "form.section.term": "Schedule",
  "form.section.channels": "Retailers",
  "form.section.channels_hint":
    "Pick country × retailer combinations to run on. Use the bulk buttons or click individual cells.",
  "form.section.notes": "Notes",
  "form.section.recurring": "Repeat (optional)",
  "form.section.recurring_hint":
    "Creates several planned spots at once with shifted dates. Useful for recurring deployment.",
  "form.section.product_hint":
    "What this spot promotes — game, console, controller, accessory… Optional but helps grouping.",
  "form.field.name": "Spot name",
  "form.field.name_placeholder": "e.g. Saros — launch trailer",
  "form.field.client": "Client",
  "form.field.comm_type": "Communication type",
  "form.field.comm_type_hint":
    "What exactly this spot does relative to the product release",
  "form.field.tags": "Tags",
  "form.field.tags_hint": "Comma-separated: \"priority, spring, …\"",
  "form.field.tags_placeholder": "priority, season, …",
  "form.field.color": "Timeline color",
  "form.field.product_name": "Product name",
  "form.field.product_name_placeholder":
    "e.g. Saros, PS5 Slim, DualSense Edge…",
  "form.field.product_kind": "Kind",
  "form.field.product_release_date": "Release date",
  "form.field.product_release_date_hint": "Optional, helps with launches",
  "form.field.product_cover_url": "Cover image URL",
  "form.field.product_cover_url_hint": "Cover, packshot, render…",
  "form.field.product_summary": "Short description",
  "form.field.product_summary_placeholder": "one short sentence about it",
  "form.field.starts_at": "Start",
  "form.field.ends_at": "End",
  "form.field.notes_placeholder":
    "anything useful (internal info, briefing…)",
  "form.recurring.toggle": "Create as a series",
  "form.recurring.frequency": "Frequency",
  "form.recurring.freq_daily": "every day",
  "form.recurring.freq_weekly": "every week",
  "form.recurring.freq_biweekly": "every 2 weeks",
  "form.recurring.freq_monthly": "every 4 weeks",
  "form.recurring.count": "Number of spots",
  "form.recurring.note":
    "Each subsequent spot will be named \"Name (n/N)\". Channel selection and product carry over to all of them.",
  "form.video.placeholder": "YouTube / Vimeo / direct mp4 URL",
  "form.video.no_spot": "— no video —",
  "form.video.new_spot": "+ New video",
  "form.video.new_spot_tooltip":
    "Opens the video library in a new tab. Reload this page after you've created the video.",
  "form.submit_create": "Plan the spot",
  "form.submit_save": "Save changes",
  "form.cancel": "Cancel",
  "form.new_campaign_title": "Plan a spot",
  "form.edit_campaign_title": "Edit spot",
  "form.hint_default":
    "Schedule a video on selected retailers in the chosen window.",
  "form.hint_template": "Pre-filled from template \"{name}\".",
  "form.hint_release": "Pre-filled from release calendar for product \"{name}\".",
  "form.hint_timeline": "Pre-filled from timeline (channels and date range).",

  // Channels picker
  "picker.selected": "Selected",
  "picker.deselect_all": "Deselect all",
  "picker.select_all": "Select all",
  "picker.country_select_all": "All in {country}",
  "picker.country_deselect_all": "None in {country}",

  // Find-slot
  "findslot.heading": "Find an available slot",
  "findslot.subtitle":
    "Pick channels and the required duration — I'll find the nearest free window where no approved spot overlaps on any selected channel. Searches {days} days ahead.",
  "findslot.field.duration": "Spot duration (days)",
  "findslot.field.from": "Search from",
  "findslot.field.channels": "Channels",
  "findslot.find": "Find available slot",
  "findslot.results.heading": "Results (top {n})",
  "findslot.results.none_found": "Not found",
  "findslot.results.empty":
    "No free {duration}-day slot across all selected channels in the next {days} days. Try a shorter duration or fewer channels.",
  "findslot.busy_intervals": "{n} busy intervals",
  "findslot.create_here": "Create here →",
  "findslot.in_n_days": "in {n} {unit}",

  // Admin
  "admin.heading": "Administration",
  "admin.tab.countries": "Countries",
  "admin.tab.chains": "Retailers",
  "admin.tab.channels": "Channel matrix",
  "admin.tab.products": "Products",
  "admin.tab.users": "Users",
  "admin.tab.templates": "Templates",
  "admin.tab.share_links": "Share links",
  "admin.tab.import": "CSV import",
  "admin.tab.archive": "Archive",
  "admin.tab.audit": "Audit log",
  "admin.share_links.description":
    "All public share links across the system. Active = a client can open it right now. Expired = its validity ran out. Revoked = an editor disabled it manually before expiry.",
  "admin.share_links.filter.active": "Active",
  "admin.share_links.filter.expired": "Expired",
  "admin.share_links.filter.revoked": "Revoked",
  "admin.share_links.filter.all": "All",
  "admin.share_links.empty.title": "No links",
  "admin.share_links.empty.description":
    "Nothing in this bucket yet.",
  "admin.share_links.col.status": "Status",
  "admin.share_links.col.target": "Target",
  "admin.share_links.col.label": "Label",
  "admin.share_links.col.created": "Created",
  "admin.share_links.col.expires": "Validity",
  "admin.share_links.col.actions": "Actions",
  "admin.share_links.target_timeline": "Timeline",
  "admin.share_links.campaign_unnamed": "Spot #{id}",
  "admin.share_links.campaign_deleted": "(spot deleted)",
  "admin.card.countries.desc":
    "Markets we deploy spots in. CZ, SK, HU, PL — any can be added.",
  "admin.card.chains.desc":
    "Retail brands hosting our screens — Datart, Alza, MediaMarkt…",
  "admin.card.channels.desc":
    "Country × Retailer matrix. Mark which combinations actually exist.",
  "admin.card.products.desc":
    "Games, consoles, controllers, accessories… with release dates and covers. Spots link to them.",
  "admin.card.users.desc":
    "Add, remove, and reset passwords for team members.",
  "admin.card.templates.desc":
    "Stored deployment configurations (client, color, channels, tags, length) for fast reuse.",
  "admin.card.import.desc":
    "Bulk import planned spots from CSV (Excel migration).",
  "admin.card.archive.desc":
    "Archived spots. Restorable, or permanently deletable.",
  "admin.card.audit.desc":
    "Who did what when — full action history.",

  // Buttons / share / template / inline edit
  "share_button.label": "Share",
  "share_button.generating": "Generating…",
  "share_button.copy": "Copy",
  "share_button.copied": "✓ Copied",
  "share_button.note":
    "Anyone with the link can view the spot without signing in. Manage links below.",
  "share_button.expires_30d": "Create link (30 days)",
  "share_button.revoke_confirm_inline": "Revoke this link?",
  "share_form.expiry_label": "Validity",
  "share_form.expiry_n_days": "{n} days",
  "share_form.label_label": "Label",
  "share_form.label_optional": "optional",
  "share_form.label_placeholder": "e.g. Pre-launch preview for Manak",
  "share_form.create": "Create",
  "timeline_share.label": "Share timeline",
  "timeline_share.title":
    "Create a public link to the currently visible timeline",
  "timeline_share.note":
    "Recipients see the full timeline at the same range and active filters, without signing in and without edit controls.",
  "share_links.section_title": "Share links",
  "share_links.empty": "This spot has no share links yet.",
  "share_links.no_active":
    "No active link. Click “Share” to create one.",
  "share_links.show_inactive": "Show inactive ({n})",
  "share_links.status.active": "Active",
  "share_links.status.expired": "Expired",
  "share_links.status.revoked": "Revoked",
  "share_links.expires_at": "valid until {date}",
  "share_links.expired_at": "expired {date}",
  "share_links.revoked_at": "revoked by {by} on {date}",
  "share_links.no_expiry": "no expiry",
  "share_links.created_at": "created by {by} · {date}",
  "share_links.revoke_confirm":
    "Revoke this link? The recipient loses access immediately.",
  "share_links.action.copy": "Copy",
  "share_links.action.extend": "Extend",
  "share_links.action.extend_tooltip": "Extend validity by 30 days",
  "share_links.action.revoke": "Revoke",
  "save_template.label": "Save as template",
  "save_template.prompt_title": "Name the template",
  "save_template.prompt_message":
    "The template remembers communication type, color, tags, channels and duration.",
  "save_template.placeholder": "e.g. Launch CZ/SK",
  "save_template.confirm": "Save",
  "save_template.success": "Template saved",
  "editable_title.save": "Save",
  "editable_title.cancel": "Cancel",
  "editable_title.empty_error": "Name can't be empty",
  "editable_title.saving": "saving…",
  "editable_title.tooltip": "Double-click to rename",
  "editable_title.rename": "Rename",

  // Share view
  "share.preview_campaign": "Public spot preview",
  "share.preview_timeline": "Public timeline preview",
  "share.expires": "This link is valid until {date}.",
  "share.open_app": "Open the app",
  "share.plan_heading": "Planned spots",

  // Print
  "print.subheading": "spot brief",
  "print.subheading_timeline": "spot schedule",
  "print.created": "Created {date}",
  "print.generated": "Generated {date}",
  "print.scan_video": "Open video",
  "print.scan_campaign": "Open spot",
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
  "unit.campaign_one": "spot",
  "unit.campaign_few": "spots",
  "unit.campaign_many": "spots",
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
