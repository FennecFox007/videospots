# videospots — stav projektu

Snapshot pro re-prompt: kdyby Claude přišel o kontext, dej mu tenhle soubor + AGENTS.md a může pokračovat.

## Co to je

Next.js 16 aplikace pro plánování video spotů v retail zobrazovačích PlayStationu (CZ/SK/HU/PL × Alza/Datart/MediaMarkt/Nay/PGS/Planeo). Multi-user. Stack:

- Next 16 App Router + Turbopack, Server Actions, žádné REST API navenek
- Drizzle ORM + Neon Postgres (HTTP serverless)
- Auth.js v5, Credentials provider, JWT sessions, bcrypt
- Tailwind v4 s class-based dark mode
- **i18n CS/EN** (cookie-based, vlastní lightweight primitiva v `lib/i18n/`), Czech defaultní
- Repo: `C:\Users\johnc\videospots\` → https://github.com/FennecFox007/videospots

## Provozní kontext (pro design rozhodnutí)

- Spoty běží na in-store screens v retailu, multiplexují se za sebou — kampaně se **smí překrývat** (více kampaní současně na jednom kanálu, lane-stacking v timeline)
- Plánuje se **dle releasu produktu**, ne dle obsazenosti kanálu. Žádný capacity planner.
- Spoty běží i o víkendech a svátcích. Weekend tinting v timeline je čistě vizuální, ne omezení.
- **Jeden spot = jedna jazyková mutace per země.** Kampaň, která běží v CZ + SK + HU, má 3 různé video URL.

## Designové principy (NEodkládat)

1. **Žádné schvalování.** Kampaň je `approved` (= aktivní) nebo `cancelled`. Hodnota `approved` se drží v DB jen kvůli zpětné kompatibilitě audit logu, uživatel vidí "Aktivní".
2. **Žádné nudge.** App neříká "tady něco chybí, udělej to". `/releases` ukazuje co vychází, ale neoznačuje "bez kampaně" jako problém. Žádné lifecycle classification kampaní (Pre-launch / Launch week / Out now badges, ⭐ marker na barech) — vyhozeno celé.
3. **Žádné judging timing.** "Příliš brzy" / "Příliš pozdě" labely vyhozeny.
4. **URL je jediný state pro filtry.** `?q`, `?country`, `?chain`, `?client`, `?runState`, `?communicationType`, `?tag`, `?from`, `?to`, `?sort`, `?order`. Stránky jsou bookmarkable.
5. **Server-rendered first.** Client islands jen kde nutné (drag, kontextové menu, filter bar, command palette, tooltip, dialogs).
6. **Lokalizace:** Czech labels, anglické error messages, `pluralCs` + `pluralKey` v messages dictionary. Country names rezolvujeme přes `Intl.DisplayNames`.
7. **Žádné mutace mimo Server Actions.** Žádné Route Handlers pro mutace.
8. **Vlastní komponenty místo knihoven.** DialogProvider, RouteModal, locale switcher, toast — všechno custom, ~50–200 řádků každé. Drobná závislost (`qrcode`, `@anthropic-ai/sdk`) jen kde reálně potřeba.

## Doménové entity (zkráceně)

- `users`, `accounts`, `sessions` — Auth.js standard
- `countries` (CZ/SK/HU/PL — DB drží jen české názvy, EN přes `Intl.DisplayNames`), `chains` (Alza/Datart/...), `channels` = (country × chain) — admin-editable
- `products` — co kampaň propaguje (game/console/controller/accessory/service/other). DB tabulka stále `game` kvůli historii, JS export `products`. Má `releaseDate`, `coverUrl`, `summary`, `kind`. Release date je metadata produktu, neváže se k UI klassifikaci kampaně.
- `campaigns` — name, client, ~~videoUrl~~ (deprecated), startsAt/endsAt, color, communicationType, tags[], notes, status (`approved`|`cancelled`), `archivedAt` (soft-delete), createdById, productId
- `campaignChannels` — junction (campaign × channel)
- **`campaignVideos`** — junction (campaign × country × videoUrl). Per-country jazyková mutace.
- `savedViews` — per-user pojmenované filter bookmarks (scope: timeline | campaigns)
- `auditLog`, `comments`, `shareLinks`, `campaignTemplates`

## Co dělá (route mapa)

- `/` — Gantt timeline. Drag bar = posun/délka/přesun na jiný kanál. Drag hlavičky = scrub času (shift+drag snap na pondělí, dvojklik = dnes). ▶ na baru = otevřít video v novém tabu (per-country).
- `/releases` — release kalendář, **čistě informativní**, promote v nav jako primární view
- `/campaigns` — tabulka s filtry, hromadné akce, CSV export, saved views
- `/campaigns/[id]` — detail (kanály, per-country videa, komentáře s @mentions, humanizovaný audit log s diffy, share, print)
- `/campaigns/new`, `/campaigns/[id]/edit` — formuláře sdílí `CampaignFormBody`. **`/new` se otevírá v modalu** (Next.js intercepting routes) když navigovaný z `/` nebo `/campaigns`; přímý URL hit = full page.
- `/admin/{countries,chains,channels,products,users,templates,import,archive,audit}` — interní CRUD. Tabs lokalizované; jednotlivé sub-pages CZ-only (interní nástroje).
- `/share/[token]` — veřejné read-only viewy (kampaň nebo timeline)
- `/print/{campaigns/[id],timeline}` — printable PDF výstupy. Campaign detail má **QR kód** (video URL nebo internal URL).
- `/tools/find-slot` — vyhledávač volných termínů

## Klíčové UX prvky

- **Timeline drag pan**: chytni hlavičku → posun v čase, **shift+drag** = snap na pondělí, **dvojklik** = skok na dnešek, floating preview "Zobrazí: 5. 5. – 8. 6." během tažení
- **Collapsible country groups**: klik na country header v timeline sbalí kanály té země. Per-user, localStorage persist (`videospots:timeline:collapsed`). Pravoklik nabízí "Sbalit ostatní (zaměřit na tuto)". Nepropaguje se do print/share — layout preference, ne data filtr.
- **Rich tooltip na barech** (250ms delay, anchor nad bar s flip-below u horního okraje)
- **Play button na barech** s `videoUrl` — `<a target="_blank">` otevře daný link v novém panelu (žádný modal). Per-channel přes country lookup (CZ Alza bar → CZ video).
- **Modal pro Novou kampaň** (Next.js intercepting routes `app/@modal/(.)campaigns/new`) — full-screen na mobile, centered card na desktop, ESC + backdrop close. Direct URL hit pořád funguje jako standalone page.
- **Humanizovaný audit log** v detailu: „Honza upravil — termín: 1. 5. → 3. 5., kanálů: 6 → 7" (diff `{from, to}` formát, backward compat se starým snapshot formátem)
- **Saved views** v FilterBar (`★ Pohledy`) — per-user, click aplikuje, "Uložit aktuální" persistuje URL params pod jménem
- **QR na print campaign**: pokud kampaň má videoUrl, QR vede na první dostupné video, jinak na interní URL
- **Toast + ConfirmDialog** systém (`components/dialog/dialog-provider.tsx`) — `useDialog().confirm()`, `prompt()`, `toast.success/error/info()`. Nahradilo `window.alert / confirm / prompt`.
- **CommunicationBadge** — pouze typ záměru (Launch / Pre-order / Out Now / DLC / Promo / …), nastavený ručně, žádné auto-classification

## i18n architektura

- `lib/i18n/messages.ts` — flat key → string dict pro CS i EN, plus `format()` (replaces `{placeholder}`) a `pluralKey()` (1 / 2-4 / 5+)
- `lib/i18n/server.ts` — `getLocale()` + `getT()` pro server komponenty (čtou cookie)
- `lib/i18n/client.tsx` — `<LocaleProvider>` + `useT()` pro client komponenty
- `lib/i18n/country.ts` — `localizedCountryName(code, fallback, locale)` přes `Intl.DisplayNames`
- `app/actions/set-locale.ts` — server action zapíše cookie + revalidate layoutu
- `components/locale-switcher.tsx` — `[CS][EN]` toggle v nav baru
- `formatMonthName(d, locale?)` v `lib/utils.ts` lokalizovaný

**Pokrytí** (vše visible během demo):
- Nav, sign-in, timeline (chrome + tooltip + bary + context menu + drag-pan preview), dashboard widgety + stats, campaigns list (filter, table, bulk), campaign detail, releases, share + print, **new/edit form** (incl. modal), **find-slot**, admin tabs + index karty, **timeline kontextové menu**, **ChannelsPicker**, share button, save-template button, editable title, dialog provider

**Czech-only by design** (interní nástroje, klient nevidí): CRUD těla admin sub-pages — countries list, chains list, channels matrix, users, templates, csv import, archive list, audit filter. Slovník už má klíče připravené, doplnit by byla mechanická práce.

## Doménové entity — schema highlights

```
campaign (id, name, client, video_url[deprecated], product_id, starts_at, ends_at,
          status, communication_type, color, tags[], notes, archived_at, …)
campaign_channel (campaign_id, channel_id)  ← junction
campaign_video (campaign_id, country_id, video_url)  ← per-country jazyková mutace
campaign_template (id, name, payload, created_by)
saved_view (id, user_id, name, scope, payload)
```

## Co je vědomě **mimo scope** (vyzkoušené a odmítnuté)

- Schvalovací workflow (draft → approved)
- Lifecycle classification kampaní vůči releasu (Pre-launch / Launch week / Out now badges, ⭐ marker na barech)
- "Naked launch" / "release bez kampaně" warnings — žádné nudge
- "Příliš brzy" / "Příliš pozdě" labely — žádné judging timing
- Material status / checklist na kampaních
- Proof tracking (důkaz, že to v retailu skutečně běželo)
- Priority pole / scoring
- Auto-rules ("když končí kampaň, vytvoř follow-up")
- IGDB integrace pro auto-fill produktů
- Side panel detail kampaně z timeline (current click → navigace stačí)
- Density modes timeline (řešit až při skutečném problému)
- Auto-mapping barvy na klienta/typ (manual color s legendou je správně)
- Release lens / vertical markers pro produkty na campaign timeline (smell of nudge)
- REST API navenek, webhooks
- Per-user permissions / role (každý přihlášený má plný přístup)

## Pravděpodobné next steps (jen návrhy, ne plán)

Diskutované „wow upgrades" pro klientské demo:

- **AI briefing generator** (button na detailu → Claude API vrátí 1-page brief)
- **Polished PDF brief** (cover artwork hero, mini-timeline strip, branded layout)
- **iCal feed** (`/api/feed/<userToken>.ics` → klient subscribuje v Outlook/Google Cal)
- **TV/wall mode** (`/tv` velkoformátový view pro office monitor)
- **Smart search NL** v command palette (Cmd+K + Claude API → URL filtry)
- **Drag-from-releases na timeline** (cross-page DnD, vyrobí launch kampaň)

Drobnější polish:

- Inertia / momentum při drag panu hlavičky (skipnuto, úzký užitek)
- Vícekriteriální sort v listu (sekundární klíč, např. client → startsAt)
- Multi-PDF export (více kampaní v jednom souboru)
- Heatmapa využití kanálů v `/admin/audit`
- Informační "souběhy" widget (X kampaní na stejném kanálu v daný den) — jen info, ne blok
- Templates picker UI více vidět na `/campaigns/new`
- Admin sub-page CRUD těla → EN (slovník připravený, jen mechanická práce)

## Klíčové soubory pro orientaci

- `lib/db/schema.ts` — domain model (campaigns, campaignVideos, products, savedViews, ...)
- `lib/db/queries.ts` — sdílené dotazy včetně `findCampaignIds(filters)`, `fetchTimelineCampaigns` (joinuje channels → countries → campaignVideos → products), `getFilterOptions` (lokalizuje country names)
- `lib/utils.ts` — formátování data, status helpers, `computedRunState`, `snapToMondayStart`, locale-aware `formatMonthName`
- `lib/i18n/{messages,server,client,country}.ts` — i18n primitiva
- `lib/communication.ts` — `COMMUNICATION_TYPES` paleta + helper funkce
- `lib/products.ts`, `lib/colors.ts` — palety
- `lib/campaign-video-form.ts` — `extractVideosByCountry(formData)` pro per-country video URLs
- `components/timeline.tsx` — Gantt, drag bar + drag pan + tooltip + ContextMenu + collapsible groups + play button
- `components/public-timeline.tsx` — read-only verze pro share view
- `components/campaign-form-body.tsx` — sdílený form `/new` i `/edit` (async server component)
- `components/filter-bar.tsx` — URL-driven filtry + saved views integrace
- `components/saved-views-menu.tsx` — dropdown pro uložené pohledy
- `components/communication-badge.tsx` — `<CommunicationBadge>`
- `components/route-modal.tsx` — generic shell pro intercepting-route modaly
- `components/dialog/dialog-provider.tsx` — Toast + Confirm + Prompt + DialogProvider
- `components/locale-switcher.tsx` — CS/EN toggle
- `components/video-embed.tsx`, `components/video-player-modal.tsx` — sdílený video render (modal nepoužívaný teď, link v novém tabu vyhrává)
- `app/@modal/(.)campaigns/new/page.tsx` — intercepting route pro modal "Nová kampaň"
- `app/campaigns/[id]/actions.ts` — main server actions (clone/cancel/move/archive/...)
- `app/campaigns/[id]/edit/actions.ts` — `updateCampaign` s diff-based audit logem
- `app/campaigns/[id]/page.tsx` — detail + `humanizeAuditEntry`
- `app/saved-views/actions.ts` — server actions pro saved views
- `app/actions/set-locale.ts` — locale switch server action
- `scripts/migrate-video-urls.ts` — one-shot migrace z `campaigns.video_url` do `campaign_video`

## Klíčové npm dependence (kromě std)

- `drizzle-orm` + `@neondatabase/serverless` — DB
- `next-auth` v5 + `@auth/drizzle-adapter` — auth
- `@anthropic-ai/sdk` — AI digest (legacy z dřívějška, prompt cache)
- `qrcode` + `@types/qrcode` — QR na print campaign
- `bcryptjs`, `zod`, `tailwind-merge`, `clsx`, `date-fns`, `lucide-react`

## Jak otevřít session

```
Pokračuju na videospots, repo C:\Users\johnc\videospots\, branch main.
Přečti AGENTS.md a STAV.md, pak: [zadání].
```
