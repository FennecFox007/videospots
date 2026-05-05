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
  "nav.releases": "Releasy",
  "nav.list": "Seznam",
  "nav.new": "+ Nová",
  "nav.spots": "Spoty",
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
  "dashboard.stats.awaiting_approval": "Čeká na schválení",
  "dashboard.stats.awaiting_none": "Vše schváleno",
  "dashboard.stats.awaiting_split": "{running} už běží · {upcoming} v plánu",
  "dashboard.stats.awaiting_upcoming_only": "{upcoming} v plánu",
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
  "detail.spot_pending":
    "Spot ještě nebyl přiřazen — kampaň je naplánována, spot doplníš později.",
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
  "releases.launch_campaign": "+ Launch kampaň",
  "releases.launch_campaign_tooltip":
    "Předvyplní formulář s tímhle produktem a launch oknem ±7 dní",
  "releases.status.released_days_ago": "Vyšlo před {n} {unit}",
  "releases.status.today": "Dnes!",
  "releases.status.in_days": "Za {n} {unit}",

  // Timeline context menu (right-click on bars / channels / country headers)
  "ctx.create_here": "+ Vytvořit kampaň zde ({chain}, od {date})",
  "ctx.create_for_country": "+ Kampaň pro celé {country}",
  "ctx.create_for_chain": "+ Nová kampaň pro {chain}",
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
    "Tato změna se týká POUZE tohoto řetězce. Ostatní řetězce v kampani zůstanou beze změny.",
  "override.cancel_in_channel": "Vypnout kampaň v tomto řetězci",
  "override.master_dates": "Termín kampaně jako celku",
  "override.clear": "Smazat přepsání",
  "override.saved": "Uloženo.",
  "override.cleared": "Přepsání zrušeno.",
  "override.error_end_before_start": "Konec nemůže být před začátkem.",
  "override.indicator_title":
    "Tento řetězec má vlastní termín odlišný od kampaně.",

  // Approval (auth-gated; share view is read-only)
  "approval.waiting": "Čeká na schválení",
  "approval.approved": "Schváleno",
  "approval.approved_on": "Schváleno {date}",
  "approval.approve": "Schvaluji",
  "approval.unapprove": "Zrušit schválení",
  "approval.approved_by": "Schválil(a) {who}",

  // Spots
  "spots.heading": "Spoty",
  "spots.subhead":
    "Knihovna všech video spotů. Spoty bez aktivní kampaně mají žluté upozornění.",
  "spots.new": "Nový spot",
  "spots.tab.undeployed": "Nenasazené",
  "spots.tab.deployed": "Nasazené",
  "spots.tab.all": "Všechny",
  "spots.tab.archived": "Archiv",
  "spots.col.name": "Spot",
  "spots.col.product": "Produkt",
  "spots.col.country": "Země",
  "spots.col.deployments": "Stav",
  "spots.col.created": "Vytvořeno",
  "spots.empty.undeployed": "Žádné nenasazené spoty — všechno běží.",
  "spots.empty.generic": "Žádné spoty v této kategorii.",
  "spots.undeployed_label": "Nenasazený",
  "spots.archived_at": "Archivováno {date}",
  "spots.play": "Přehrát",
  "spots.back_to_list": "Zpět na seznam",
  "spots.section.preview": "Náhled",
  "spots.section.deployments": "Aktivní kampaně",
  "spots.deployments.empty":
    "Tento spot zatím není v žádné aktivní kampani.",
  "spots.action.archive": "Archivovat",
  "spots.action.archive_tooltip":
    "Skryje spot z výchozího seznamu. Historie kampaní zůstane.",
  "spots.action.unarchive": "Obnovit z archivu",
  "spots.action.delete": "Smazat trvale",
  "spots.action.delete_tooltip":
    "Funguje jen pokud spot není v žádné kampani.",
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

  // Dashboard: undeployed spots tile
  "dashboard.stats.undeployed_spots": "Nenasazené spoty",
  "dashboard.stats.undeployed_none": "Vše nasazené",
  "dashboard.stats.undeployed_sub": "vyrobených, ale nezařazených",
  "filter.approval.all": "Schválení",
  "filter.approval.pending": "Čeká na schválení",
  "filter.approval.approved": "Schváleno",
  "filter.missing_spot.label": "Bez spotu",
  "filter.missing_spot.tooltip":
    "Kampaně, kde alespoň jedna země ještě nemá přiřazený spot.",

  // Spots drawer (toolbar button on /, slide-out panel).
  // Label is "Knihovna" / "Library" — distinct from the top-nav "Spoty" link
  // which goes to the full /spots admin page. The drawer is the quick
  // drag-onto-timeline surface; the page is the manage-edit-archive surface.
  "spots_drawer.button": "Knihovna",
  "spots_drawer.button_tooltip":
    "Otevřít knihovnu spotů. Můžeš spot přetáhnout na timeline a vytvořit z něj kampaň.",
  "spots_drawer.aria_label": "Knihovna spotů",
  "spots_drawer.heading": "Knihovna spotů",
  "spots_drawer.hint": "Přetáhni spot na timeline pro vytvoření kampaně.",
  "spots_drawer.search_placeholder": "Hledat spot…",
  "spots_drawer.tab.undeployed": "Nenasazené",
  "spots_drawer.tab.all": "Všechny",
  "spots_drawer.empty.undeployed": "Žádné nenasazené spoty.",
  "spots_drawer.empty.all": "Žádné spoty v knihovně.",
  "spots_drawer.undeployed": "Nenasazený",
  "spots_drawer.undeployed_count": "{count} nenasazených",
  "spots_drawer.card_drag_hint": "Přetáhni na timeline",
  "spots_drawer.footer_hint": "Přetáhni spot na řádek kanálu",
  "spots_drawer.new_link": "+ Nový spot",
  "spots_drawer.action.play": "Přehrát",
  "spots_drawer.action.edit": "Upravit",

  // Spot drop modal — opens after dragging a spot onto a channel row
  "spot_drop.title": "Vytvořit kampaň ze spotu",
  "spot_drop.field.name": "Název kampaně",
  "spot_drop.field.channels": "Kanály",
  "spot_drop.field.channels_hint":
    "Přetáhnutý kanál je vybraný. Můžeš přidat další kanály ve stejné zemi.",
  "spot_drop.dropped_here": "drop",
  "spot_drop.approve_now": "Schválit hned",
  "spot_drop.submit": "Vytvořit kampaň",
  "spot_drop.created": "Kampaň vytvořena.",
  "spot_drop.country_mismatch":
    "Spot je pro {spot}, drop byl na {target}. Spot je pro jednu zemi.",
  "spot_drop.error_name": "Vyplň název kampaně.",
  "spot_drop.error_no_channels": "Vyber alespoň jeden kanál.",
  "spot_drop.error_end_before_start": "Konec nemůže být před začátkem.",

  // Campaign form body (new + edit)
  "form.section.basic": "Základní údaje",
  "form.section.product": "Produkt",
  "form.section.video": "Spoty (jeden per země)",
  "form.section.video_hint":
    "Vyber spot z knihovny pro každou zemi. Pokud potřebný spot ještě nemáš, klikni na „+ Nový spot“ — otevře se ve vedlejší záložce, po vytvoření obnov tuto stránku.",
  "form.section.term": "Termín",
  "form.section.channels": "Kanály",
  "form.section.channels_hint":
    "Vyber kombinace stát × řetězec, kde má kampaň běžet. Hromadný výběr přes tlačítka, jednotlivé pak jen klikni.",
  "form.section.notes": "Poznámky",
  "form.section.recurring": "Opakovat (volitelné)",
  "form.section.recurring_hint":
    "Vytvoří víc kampaní najednou s posunutými termíny. Vhodné pro pravidelné spoty.",
  "form.section.product_hint":
    "Co kampaň propaguje — hra, konzole, ovladač, příslušenství… Volitelné, ale pomáhá při třídění.",
  "form.field.name": "Název kampaně",
  "form.field.name_placeholder": "např. Saros — launch trailer",
  "form.field.client": "Klient",
  "form.field.comm_type": "Typ komunikace",
  "form.field.comm_type_hint":
    "Co přesně tahle kampaň dělá vůči vydání produktu",
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
  "form.recurring.toggle": "Vytvořit sérii kampaní",
  "form.recurring.frequency": "Frekvence",
  "form.recurring.freq_daily": "každý den",
  "form.recurring.freq_weekly": "každý týden",
  "form.recurring.freq_biweekly": "každé 2 týdny",
  "form.recurring.freq_monthly": "každé 4 týdny",
  "form.recurring.count": "Počet kampaní",
  "form.recurring.note":
    "Každá další kampaň bude pojmenovaná „Název (n/N)“. Výběr kanálů a hra se zachovají u všech.",
  "form.video.placeholder": "YouTube / Vimeo / přímý mp4 odkaz",
  "form.video.no_spot": "— žádný spot —",
  "form.video.new_spot": "+ Nový spot",
  "form.video.new_spot_tooltip":
    "Otevře knihovnu spotů v nové záložce. Po vytvoření obnov tuto stránku.",
  "form.submit_create": "Vytvořit kampaň",
  "form.submit_save": "Uložit změny",
  "form.cancel": "Zrušit",
  "form.new_campaign_title": "Nová kampaň",
  "form.edit_campaign_title": "Upravit kampaň",
  "form.hint_default":
    "Naplánuj video spot na vybrané kanály v zadaném období.",
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
    "Vyber kanály a požadovanou délku — najdu nejbližší volné období, kde se na žádném vybraném kanálu nepřekrývá schválená kampaň. Hledá se {days} dní dopředu.",
  "findslot.field.duration": "Délka kampaně (dní)",
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
  "admin.tab.import": "Import CSV",
  "admin.tab.archive": "Archiv",
  "admin.tab.audit": "Audit log",
  "admin.card.countries.desc":
    "Trhy, kde provozujeme kampaně. CZ, SK, HU, PL — přidat lze libovolný.",
  "admin.card.chains.desc":
    "Maloobchodní brandy s našimi zobrazovači — Datart, Alza, MediaMarkt…",
  "admin.card.channels.desc":
    "Matice Stát × Řetězec. Označ které kombinace skutečně existují.",
  "admin.card.products.desc":
    "Hry, konzole, ovladače, příslušenství… s daty vydání a covery. Kampaně se na ně mapují.",
  "admin.card.users.desc":
    "Přidávej, mažeš, nastavuješ hesla členům týmu.",
  "admin.card.templates.desc":
    "Uložené konfigurace kampaní (klient, barva, kanály, štítky, délka) pro rychlé opakování.",
  "admin.card.import.desc":
    "Hromadný import kampaní z CSV (migrace z Excelu).",
  "admin.card.archive.desc":
    "Archivované kampaně. Lze obnovit zpět, nebo definitivně smazat.",
  "admin.card.audit.desc":
    "Co kdo kdy udělal — kompletní historie akcí.",

  // Save buttons / share / template
  "share_button.label": "Sdílet",
  "share_button.generating": "Generuji…",
  "share_button.copy": "Kopírovat",
  "share_button.copied": "✓ Zkopírováno",
  "share_button.note":
    "Platnost 30 dní. Kdokoli s odkazem uvidí kampaň bez přihlášení.",
  "share_button.expires_30d": "Vytvořit odkaz (30 dní)",
  "timeline_share.label": "Sdílet timeline",
  "timeline_share.title":
    "Vytvořit veřejný odkaz na aktuálně viditelnou timeline",
  "timeline_share.note":
    "Platnost 30 dní. Klient uvidí celou timeline ve stejném rozsahu a s aplikovanými filtry, bez přihlášení a bez editačních tlačítek.",
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
  "nav.spots": "Spots",
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
  "dashboard.stats.awaiting_approval": "Awaiting approval",
  "dashboard.stats.awaiting_none": "All approved",
  "dashboard.stats.awaiting_split": "{running} running · {upcoming} upcoming",
  "dashboard.stats.awaiting_upcoming_only": "{upcoming} upcoming",
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
  "detail.spot_pending":
    "No spot assigned yet — the campaign is scheduled, attach a spot later.",
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
  "releases.launch_campaign": "+ Launch campaign",
  "releases.launch_campaign_tooltip":
    "Pre-fills the form with this product and a ±7-day launch window",
  "releases.status.released_days_ago": "Released {n} {unit} ago",
  "releases.status.today": "Today!",
  "releases.status.in_days": "In {n} {unit}",

  // Timeline context menu
  "ctx.create_here": "+ New campaign here ({chain}, from {date})",
  "ctx.create_for_country": "+ New campaign for all of {country}",
  "ctx.create_for_chain": "+ New campaign for {chain}",
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
    "This change applies ONLY to this retailer. Other retailers in the campaign stay unchanged.",
  "override.cancel_in_channel": "Turn campaign off in this retailer",
  "override.master_dates": "Campaign-wide dates",
  "override.clear": "Clear override",
  "override.saved": "Saved.",
  "override.cleared": "Override cleared.",
  "override.error_end_before_start": "End cannot be before start.",
  "override.indicator_title":
    "This retailer has its own schedule, different from the campaign.",

  // Approval (auth-gated; share view is read-only)
  "approval.waiting": "Waiting for approval",
  "approval.approved": "Approved",
  "approval.approved_on": "Approved {date}",
  "approval.approve": "Approve",
  "approval.unapprove": "Clear approval",
  "approval.approved_by": "Approved by {who}",

  // Spots
  "spots.heading": "Spots",
  "spots.subhead":
    "Library of every video creative. Spots not in any active campaign get an amber heads-up.",
  "spots.new": "New spot",
  "spots.tab.undeployed": "Undeployed",
  "spots.tab.deployed": "Deployed",
  "spots.tab.all": "All",
  "spots.tab.archived": "Archive",
  "spots.col.name": "Spot",
  "spots.col.product": "Product",
  "spots.col.country": "Country",
  "spots.col.deployments": "Status",
  "spots.col.created": "Created",
  "spots.empty.undeployed": "No undeployed spots — everything's scheduled.",
  "spots.empty.generic": "No spots in this view.",
  "spots.undeployed_label": "Undeployed",
  "spots.archived_at": "Archived {date}",
  "spots.play": "Play",
  "spots.back_to_list": "Back to list",
  "spots.section.preview": "Preview",
  "spots.section.deployments": "Active campaigns",
  "spots.deployments.empty":
    "This spot isn't currently used in any active campaign.",
  "spots.action.archive": "Archive",
  "spots.action.archive_tooltip":
    "Hides the spot from default lists. Campaign history stays intact.",
  "spots.action.unarchive": "Restore from archive",
  "spots.action.delete": "Delete permanently",
  "spots.action.delete_tooltip":
    "Only works if the spot isn't referenced by any campaign.",
  "spots.form.heading_new": "New spot",
  "spots.form.subhead_new":
    "Register a video creative for later use in campaigns.",
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

  // Dashboard: undeployed spots tile
  "dashboard.stats.undeployed_spots": "Undeployed spots",
  "dashboard.stats.undeployed_none": "All scheduled",
  "dashboard.stats.undeployed_sub": "produced but unused",
  "filter.approval.all": "Approval",
  "filter.approval.pending": "Awaiting approval",
  "filter.approval.approved": "Approved",
  "filter.missing_spot.label": "Missing spot",
  "filter.missing_spot.tooltip":
    "Campaigns with at least one country still waiting for a spot.",

  // Spots drawer — see CS comment above for naming rationale.
  "spots_drawer.button": "Library",
  "spots_drawer.button_tooltip":
    "Open the spot library. Drag a spot onto the timeline to create a campaign from it.",
  "spots_drawer.aria_label": "Spot library",
  "spots_drawer.heading": "Spot library",
  "spots_drawer.hint": "Drag a spot onto the timeline to create a campaign.",
  "spots_drawer.search_placeholder": "Search spots…",
  "spots_drawer.tab.undeployed": "Undeployed",
  "spots_drawer.tab.all": "All",
  "spots_drawer.empty.undeployed": "No undeployed spots.",
  "spots_drawer.empty.all": "No spots in the library.",
  "spots_drawer.undeployed": "Undeployed",
  "spots_drawer.undeployed_count": "{count} undeployed",
  "spots_drawer.card_drag_hint": "Drag onto the timeline",
  "spots_drawer.footer_hint": "Drop a spot onto a channel row",
  "spots_drawer.new_link": "+ New spot",
  "spots_drawer.action.play": "Play",
  "spots_drawer.action.edit": "Edit",

  // Spot drop modal
  "spot_drop.title": "Create campaign from spot",
  "spot_drop.field.name": "Campaign name",
  "spot_drop.field.channels": "Retailers",
  "spot_drop.field.channels_hint":
    "The retailer you dropped on is selected. Add other retailers in the same country if you want.",
  "spot_drop.dropped_here": "drop",
  "spot_drop.approve_now": "Approve now",
  "spot_drop.submit": "Create campaign",
  "spot_drop.created": "Campaign created.",
  "spot_drop.country_mismatch":
    "Spot is for {spot}, dropped on {target}. A spot is country-bound.",
  "spot_drop.error_name": "Fill in the campaign name.",
  "spot_drop.error_no_channels": "Pick at least one retailer.",
  "spot_drop.error_end_before_start": "End cannot be before start.",

  // Campaign form body
  "form.section.basic": "Basics",
  "form.section.product": "Product",
  "form.section.video": "Spots (one per country)",
  "form.section.video_hint":
    "Pick a spot from the library for each country. If the spot you need doesn't exist yet, click \"+ New spot\" — it opens in another tab; reload this page after creating.",
  "form.section.term": "Schedule",
  "form.section.channels": "Retailers",
  "form.section.channels_hint":
    "Pick country × retailer combinations to run on. Use the bulk buttons or click individual cells.",
  "form.section.notes": "Notes",
  "form.section.recurring": "Repeat (optional)",
  "form.section.recurring_hint":
    "Creates several campaigns at once with shifted dates. Useful for recurring spots.",
  "form.section.product_hint":
    "What this campaign promotes — game, console, controller, accessory… Optional but helps grouping.",
  "form.field.name": "Campaign name",
  "form.field.name_placeholder": "e.g. Saros — launch trailer",
  "form.field.client": "Client",
  "form.field.comm_type": "Communication type",
  "form.field.comm_type_hint":
    "What exactly this campaign does relative to the product release",
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
  "form.recurring.count": "Number of campaigns",
  "form.recurring.note":
    "Each subsequent campaign will be named \"Name (n/N)\". Channel selection and product carry over to all of them.",
  "form.video.placeholder": "YouTube / Vimeo / direct mp4 URL",
  "form.video.no_spot": "— no spot —",
  "form.video.new_spot": "+ New spot",
  "form.video.new_spot_tooltip":
    "Opens the spots library in a new tab. Reload this page after you've created the spot.",
  "form.submit_create": "Create campaign",
  "form.submit_save": "Save changes",
  "form.cancel": "Cancel",
  "form.new_campaign_title": "New campaign",
  "form.edit_campaign_title": "Edit campaign",
  "form.hint_default":
    "Schedule a video spot on selected retailers in the chosen window.",
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
    "Pick channels and the required duration — I'll find the nearest free window where no approved campaign overlaps on any selected channel. Searches {days} days ahead.",
  "findslot.field.duration": "Campaign duration (days)",
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
  "admin.tab.import": "CSV import",
  "admin.tab.archive": "Archive",
  "admin.tab.audit": "Audit log",
  "admin.card.countries.desc":
    "Markets we operate campaigns in. CZ, SK, HU, PL — any can be added.",
  "admin.card.chains.desc":
    "Retail brands hosting our screens — Datart, Alza, MediaMarkt…",
  "admin.card.channels.desc":
    "Country × Retailer matrix. Mark which combinations actually exist.",
  "admin.card.products.desc":
    "Games, consoles, controllers, accessories… with release dates and covers. Campaigns link to them.",
  "admin.card.users.desc":
    "Add, remove, and reset passwords for team members.",
  "admin.card.templates.desc":
    "Stored campaign configurations (client, color, channels, tags, length) for fast reuse.",
  "admin.card.import.desc":
    "Bulk import campaigns from CSV (Excel migration).",
  "admin.card.archive.desc":
    "Archived campaigns. Restorable, or permanently deletable.",
  "admin.card.audit.desc":
    "Who did what when — full action history.",

  // Buttons / share / template / inline edit
  "share_button.label": "Share",
  "share_button.generating": "Generating…",
  "share_button.copy": "Copy",
  "share_button.copied": "✓ Copied",
  "share_button.note":
    "Valid for 30 days. Anyone with the link can view the campaign without signing in.",
  "share_button.expires_30d": "Create link (30 days)",
  "timeline_share.label": "Share timeline",
  "timeline_share.title":
    "Create a public link to the currently visible timeline",
  "timeline_share.note":
    "Valid for 30 days. Recipients see the full timeline at the same range and active filters, without signing in and without edit controls.",
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
