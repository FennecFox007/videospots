# videospots — stav projektu

Snapshot pro re-prompt: kdyby Claude přišel o kontext, dej mu tenhle soubor + AGENTS.md a může pokračovat.

## Co to je

Next.js 16 aplikace pro plánování video spotů v retail zobrazovačích PlayStationu (CZ/SK/HU/PL × Alza/Datart/MediaMarkt/Nay/PGS/Planeo). Multi-user, **interní nástroj agentury**. Klient má přístup buď read-only přes `/share/<token>` link, nebo (pokud má účet) plný přístup do systému, kde může mj. schvalovat. Stack:

- Next 16 App Router + Turbopack, Server Actions, žádné REST API navenek (kromě `/api/campaigns/[id]/peek` pro client-side peek panel a `/api/search` pro Cmd+K)
- Drizzle ORM + Neon Postgres (HTTP serverless)
- Auth.js v5, Credentials provider, JWT sessions, bcrypt
- Tailwind v4 s **cookie-driven** dark mode (`videospots-theme`, server-side render `dark` třídy na `<html>`, žádný inline init script)
- **i18n CS/EN** (cookie-based, vlastní lightweight primitiva v `lib/i18n/`), Czech defaultní
- Repo: `C:\Users\johnc\videospots\` → https://github.com/FennecFox007/videospots

## Provozní + obchodní kontext

- Spoty běží na in-store screens v retailu, multiplexují se za sebou — kampaně se **smí překrývat** (více kampaní současně na jednom kanálu, lane-stacking)
- Spoty běží i o víkendech a svátcích. Weekend tinting = vizuální only.
- **Jeden spot = jedna jazyková mutace per země** (campaign_video junction).
- **NDA**: plánované kampaně + nevydané produkty + spoty před releasem nesmí opustit interní prostředí. Aktuální deploy strategy = **lokálně + Cloudflare Tunnel** pro občasné sdílení s klientem. Plný hosting (Vercel / VPS / NAS) odložený na po-podpis-smlouvy.
- Klient se s aplikací nemusí aktivně mazlit — typický flow je: agentura připraví kampaň, pošle share link, klient si projde, případně se přihlásí a klikne **Schvaluji**.

## Designové principy (canonical state)

1. **Schvalování JE — auth-gated.** Kampaně mají `clientApprovedAt` + `clientApprovedComment` + `approvedById`. Schvaluje **přihlášený uživatel** (z baru / peek panelu / detail page). Share view je read-only, recipient vidí jen badge. Schválení je **trvalé** — editace kampaně ho neinvaliduje.
2. **Per-retailer overrides.** Datart vyprodal? Pravoklik na bar → "Upravit jen tento řetězec" → vlastní termín nebo cancellation just for that channel. Master kampaň ostatní řetězce neovlivní. Bary s override jsou italic + ✱ + non-draggable (drag by silently shiftnul master).
3. **Spoty jako first-class entity.** Spot = (product × country × URL). Existuje samostatně v knihovně `/spots`, kampaně ho jen referencují přes `campaign_video.spot_id`. **Kampaň může existovat bez spotu** — plánuje se měsíce dopředu, spoty se vyrábí později a doplňují přes edit form.
4. **Žádný judging timing / nudge.** App neříká "tady něco chybí". `/releases` ukazuje co vychází bez označení "bez kampaně". Žádné lifecycle classification ("Pre-launch / Out now"), žádné "naked launch" warnings. **Výjimka:** "spot pending" stav je viditelný (dashed kroužek na baru, amber box v detailu), ale vyloženě jako informace, ne jako chyba.
5. **URL = filter state.** `?q`, `?country`, `?chain`, `?runState`, `?approval`, `?missingSpot`, `?tag`, `?from`, `?to`, `?sort`, `?order`. Stránky jsou bookmarkable. (`?client` a `?communicationType` byly v dřívějších verzích — partner je odstranil, řada filtrů se zjednodušila. Sloupce na campaigns zůstávají, jen už podle nich nefiltrujeme.)
6. **Server-rendered first.** Client islands jen kde nutné (drag, kontextové menu, filter bar, command palette, tooltip, dialogs, peek panel).
7. **Lokalizace:** CZ labels, EN error messages, `pluralKey` v dictionary. Country names přes `Intl.DisplayNames`.
8. **Žádné mutace mimo Server Actions.** API routes jen pro reads (peek, search).
9. **Vlastní komponenty místo knihoven.** DialogProvider, RouteModal, SidePanel, locale switcher, toast — všechno custom, ~50–250 řádků.

## Doménové entity (zkráceně)

- `users`, `accounts`, `sessions` — Auth.js
- `countries` (CZ/SK/HU/PL — DB drží jen české názvy, EN přes `Intl.DisplayNames`), `chains`, `channels` = (country × chain) — admin-editable
- `products` — co kampaň propaguje (game/console/controller/accessory/service/other). DB tabulka `game` z historie. `releaseDate`, `coverUrl`, `summary`, `kind`.
- **`spots`** — knihovna video creativ. (product × country × videoUrl) + volitelný `name`, `archivedAt`, `createdById`. Existuje samostatně, kampaně ho referencují přes `campaign_video.spot_id`. Spot bez aktivní kampaně = "nenasazený" (viditelné na `/spots` + dashboard tile).
- `campaigns` — name, client, ~~videoUrl~~ (deprecated), startsAt/endsAt, color, communicationType, tags[], notes, status (`approved`|`cancelled`), `archivedAt`, `clientApprovedAt`, `clientApprovedComment`, `approvedById`, createdById, productId
- **`campaignChannels`** — junction (campaign × channel) **+ overrides**: `startsAt`, `endsAt`, `cancelledAt` (všechny nullable; null = inherit master). Per-retailer schedule.
- **`campaignVideos`** — junction (campaign × country) → `spot_id` NOT NULL. Připojuje konkrétní spot k tomu, jak ho kampaň v dané zemi nasazuje. Pokud je tahle row pro (kampaň, země) chybí = "spot ještě nepřiřazen" (kampaň je naplánovaná, čeká se na produkci).
- `savedViews` — per-user pojmenované filter bookmarks (scope: timeline | campaigns)
- `auditLog` (userId nullable — historicky pro public approve, dnes vždy auth), `comments`, `campaignTemplates`
- `shareLinks` — public read-only odkazy (`/share/[token]`). Lifecycle: `expiresAt` (nullable, ale UI nabízí jen 7/30/90 dnů — žádné "bez expirace") + `revokedAt`/`revokedById` pro soft-revoke + volitelný `label` text pro orientaci v management listu. Aktivní = `revokedAt IS NULL AND (expiresAt IS NULL OR expiresAt > now)`. Centralizováno v `lib/db/queries.ts:shareLinkIsActive(now)` + `shareLinkStatus({...})`.

## Schvalovací flow

```
Přihlášený uživatel klikne "Schvaluji"
  z bar context menu
  / z peek panel footeru
  / z detail page hlavičky
       ↓
approveCampaign(id, note?)  — server action, requireUser()
       ↓
campaigns.client_approved_at = now
campaigns.approved_by_id = userId
campaigns.client_approved_comment = note ?? null
auditLog.insert({action: "approved", userId, note})
       ↓
revalidatePath(/, /campaigns, /campaigns/[id])
```

**Vizuální stav v authed timeline:**
- Neschválené bary mají **diagonální bílé šrafování** přes barvu kampaně (`repeating-linear-gradient(45deg, ...)`)
- Schválené bary jsou solidně barvené
- Cancelled bary jsou šedé + přeškrtnuté (silnější signál než šrafování)
- Filter chip ve FilterBar: "Čeká na schválení" / "Schváleno" / všechno

**Vizuální stav v share view:**
- Single-campaign share: zelený "Schváleno [datum]" badge nahoře, jen informačně
- Timeline share: bary mají šrafování i tady (klient vidí stav), ale klik na bar otevře jen modal s videem + datumy, žádný approve form

**Trvalost:** schválení se po editaci kampaně **nezhasne**. Po V2 možná verze "approval snapshot" (uložit, co bylo schváleno, a pokud edit změní něco podstatného, requestnout re-approval). Pro V1 záměrně jednoduché.

## Per-retailer overrides (Datart vyprodal scénář)

Pravoklik bar → **"Upravit jen tento řetězec"** otevře dialog s:
- Datum start (pre-fill efektivním datem)
- Datum end
- Checkbox **"Vypnout kampaň v tomto řetězci"** (nastaví `cancelledAt`)
- Read-only "Termín kampaně jako celku" pro reference
- Tlačítko **"Smazat přepsání"** (jen když existuje)

`fetchTimelineCampaigns` vrací **efektivní data** = `channelStartsAt ?? masterStartsAt`. JS-side coalesce, ne SQL — Drizzle parsuje Date objekty jen u sloupců s `mode: "date"`, raw `sql\`COALESCE(...)\`` vrací stringy a rozbije `.getTime()`.

**Drag lock**: bary s override **nelze přetahovat**. Drag by updatoval **master** kampaň, což by silently posunul ostatní řetězce. Klik na overridovaný bar místo drag = otevře peek. Aby se obnovila drag schopnost, smaž override v dialogu.

**Caveat**: range filter v queries.ts používá master termíny, ne efektivní. Override který by posouval bar mimo master rozsah by se nezobrazil. V praxi se overrides používají pro **zkrácení** uvnitř masteru, takže to v1 stačí.

## Pracovní flow se spoty (canonical)

```
Plánování (např. leden, kampaň pro květen):
  /campaigns/new → vyber kanály → spot dropdownů necháš na "— žádný spot —"
  → ulož

Kampaň existuje, je v timeline. Bar má místo ▶ malý dashed kroužek
(stav "spot pending"). Peek/detail ukazují "Spoty (0/N)" + amber boxy.
Filter chip "Bez spotu" najde takové kampaně globálně.

Produkce (například duben):
  /spots/new × N (jeden per země) → uloží do knihovny

Připojení (před spuštěním):
  /campaigns/<id>/edit → spot dropdownů jsou nově nabité spoty pro každou zemi → vyber → ulož
  Bar v timeline: dashed kroužek se mění na ▶
```

Klíčová vlastnost: **kampaň bez spotu je legitimní stav**, ne chyba. Vizuální cue je intentionally subtle — informuje, ale nedělá z toho problém.

## Co dělá (route mapa)

- `/` — Gantt timeline. Drag bar = posun/délka/přesun. Drag hlavičky = scrub času. **Klik na bar** = otevře peek panel. **Pravoklik** = kontextové menu (Otevřít / Upravit / Upravit jen tento řetězec / Schvaluji|Zrušit schválení / Sdílet odkaz / Posunout / Klonovat / Cancel / Archive). **▶** na baru = video v novém tabu, **⊕ (dashed)** = spot ještě nepřiřazen pro tuto zemi.
- `/releases` — release kalendář, čistě informativní
- `/campaigns` — tabulka s filtry, hromadné akce, CSV export, saved views. Klik na řádek otevře peek (modifier-klik = nová záložka)
- `/campaigns/[id]` — detail (kanály, per-country videa, komentáře, audit log, share, print, **approval state v hlavičce**). Pending země mají dashed amber box místo embedu + link "Přiřadit spoty".
- `/campaigns/new`, `/campaigns/[id]/edit` — formuláře. `/new` se otevírá v modalu (intercepting routes) když navigovaný z `/` nebo `/campaigns`. **Per-country dropdown z knihovny spotů** + odkaz "+ Nový spot" (otevře `/spots/new` v nové záložce). "— žádný spot —" je validní volba pro plán-bez-produkce.
- **`/spots`** — knihovna spotů. Primární přepínač: 4 záložky (**Nenasazené** | Nasazené | Všechny | Archiv) — default landing = Nenasazené. Pod nimi **filtrová řada** (search + země + produkt + sort + group toggle, URL-driven přes `?q=&country=&product=&sort=&group=`). Default zobrazení = **group by country** (collapsible sekce per země), volitelně přepínatelné na plochý seznam. Sort: nejnovější (default) | abecedně | podle počtu nasazení. Žádné složky — facetové filtry + auto-grouping nahrazují manuální hierarchii a škálují i na 100+ spotů bez maintenance burden.
- **`/spots/new`** — registrace nového spotu (jméno volitelné, produkt find-or-create, země radio chips, URL).
- **`/spots/[id]`** — detail s embed přehrávačem, seznam aktivních kampaní, edit, archivace, smazání (jen když není v žádné kampani).
- `/admin/{countries,chains,channels,products,users,templates,share-links,import,archive,audit}` — interní CRUD.
- **`/admin/share-links`** — globální přehled veřejných sdílených odkazů. Status filter chips (Aktivní / Expirované / Deaktivované / Všechny) s počtem v každém bucketu (přes `count(*) FILTER`). Sloupce: stav, cíl (kampaň-typovaný link je clickable na detail; timeline-typovaný ukazuje stručný preview filterů), štítek, vytvořeno (kdy + kdo), platnost, akce (Kopírovat / Prodloužit / Deaktivovat).
- `/share/[token]` — public read-only (kampaň nebo timeline). **Žádné akční formuláře** — informační jen.
- `/print/{campaigns/[id],timeline}` — printable PDF. Detail má QR kód.

## Klíčové UX prvky

- **Peek panel** (pravý drawer) — otevírá se klikem na bar v timeline / řádek v `/campaigns`. Imperativní store v `lib/peek-store.ts` (žádné intercepting routes — Turbopack je s tím nestabilní). URL sync přes `?peek=<id>` + `history.replaceState` (sdílitelné, žádný server re-render). Footer akce: Otevřít detail, Upravit, **Schvaluji**, Klonovat, Cancel, Archive. Videos sekce: "Spoty (X/Y)" + per-country play link nebo "Spot ještě nebyl přiřazen". Cancel-on-change při rychlém přepínání mezi bary.
- **Bar context menu** — pravoklik na bar v timeline. Položky: Otevřít detail, Upravit, **Upravit jen tento řetězec**, **Schvaluji** / **Zrušit schválení**, **Sdílet odkaz** (jeden klik vygeneruje + zkopíruje share link), Posunout o týden ←/→, Klonovat, Cancel/Reactivate, Archive.
- **Channel override dialog** — viz výše per-retailer sekce.
- **SpotsDrawer + drag-and-drop** — toolbar tlačítko **📺 Knihovna** v hlavičce timeline (s žlutým badge počtu nenasazených). Záměrně **jiný název než nav link "Spoty"** (který vede na `/spots` admin) — drawer je rychlá drag-onto-timeline plocha, `/spots` je manage/edit/archive. Klik otevře 320 px slide-out drawer zprava: search + tabs (Nenasazené / Všechny) + spoty seskupené podle země. Karty jsou HTML5 draggable (`SPOT_DRAG_MIME`), drop targety jsou kanálové řádky v timeline. Drop validuje země: matching → otevře `<SpotDropModal>` s pre-fillem (název = jméno spotu, datum = drop position, end = +14 dní, zaškrtnutý jen ten kanál; volitelně další kanály ve stejné zemi); mismatched → toast "Spot je pro CZ, drop na SK".
- **Ghost preview během dragu** — když držíš spot nad cílovým kanálem, ten řádek si rezervuje extra lane vespod (transition 150 ms na `height`), kanály pod ním se posunou dolů ("dělá se místo"). V té nové lane se kreslí přerušovaný indigo bar se jménem spotu a nad ním plovoucí pilulka s daty v CZ formátu (`5. 5. 2026 – 18. 5. 2026 (14 dní)`). Country mismatch → preview se neukáže, dropEffect="none". HTML5 spec hides `dataTransfer.getData()` v `dragover`, proto držíme paralelní `currentDrag` v `lib/spot-drop-store.ts`, set v drawer `onDragStart`, read sync v timeline `onDragOver`.
- **DateRangeSummary helper** pod `<input type="date">` v drop modalu i override dialogu — `<input type="date">` se renderuje v browser locale (často `YYYY-MM-DD` v en-US), tak pod ním vždy ukazujeme `→ 5. 5. 2026 – 18. 5. 2026 (14 dní)` v CZ formátu jako pojistku.
- **Public campaign modal** v share-timeline view — klik na bar otevře malý modal s videem (per-country) + metadaty + approved badge (jen info).
- **Timeline drag pan**: chytni hlavičku → posun v čase, **shift+drag** = snap na pondělí, **dvojklik** = skok na dnešek
- **Collapsible country groups**: per-user, localStorage persist
- **Rich tooltip** na barech (250ms delay)
- **Play button** vs **dashed kroužek** na pravém okraji baru — má spot / čeká na spot
- **Modal pro Novou kampaň** (intercepting routes) — full-screen mobile, centered desktop
- **Humanizovaný audit log** v detailu
- **Saved views** v FilterBar (per-user)
- **QR na print campaign**
- **Toast + ConfirmDialog** systém
- **CommunicationBadge** (Launch / Pre-order / Out Now / DLC / Promo / …)
- **Dashboard tiles** (`app/page.tsx` → `DashboardStats`):
  - **Celkem kampaní** — total + this month
  - **Čeká na schválení** — count + "X už běží · Y v plánu" (urgentní vs. budoucí)
  - **Top klient** — campaigns count
  - **Nenasazené spoty** — count of spots without active campaign

## Vizuální cue cheatsheet (3 nezávislé osy na barech)

| Stav | Bar |
|---|---|
| Schválená, má spot | Solid barva + ▶ |
| Schválená, čeká na spot | Solid barva + ⊕ (dashed kruh) |
| Neschválená, má spot | Šrafovaná + ▶ |
| Neschválená, čeká na spot | Šrafovaná + ⊕ |
| Per-channel override | Italic + ✱ (kombinuje se s ostatním) |
| Cancelled (kampaň nebo channel) | Šedá + přeškrtnutá (přebije ostatní) |

## Toolbar styling discipline

Hlavní toolbar (zoom presety, date nav, kontextové presety) zůstává na **`text-sm` + `px-3 py-1.5`** — větší cíle pro hlavní navigaci. **FilterBar řada pod ním** (search, country, chain, runState, approval, missingSpot, tag, Pohledy) je naopak na **`text-xs` + `px-2.5 py-1`** — sub-úroveň pod toolbarem, drží jeden řádek častěji.

## Z-index hierarchy (canonical)

Vrstvení overlayů — když přidáváš novou plovoucí komponentu, drž tuhle stupnici:

| Layer | z-index | Příklady |
|---|---|---|
| Bary v timeline | `z-[1]` až `z-[3]` | DraggableBar, ghost preview, drag-pill |
| Toolbar drawer (transientní, koexistuje s page) | `z-[60]` | `<SpotsDrawer>` |
| Side panel (kontextové, blokuje page focus) | `z-[70]` | `<SidePanel>` (CampaignPeek) |
| Modal (blokující dialog) | `z-[80]` | `<NewSpotModal>`, `<SpotDropModal>`, `<ChannelOverrideDialog>`, `<RouteModal>`, public-timeline modal |
| DialogProvider (confirm/prompt — overrides everything) | `z-[90]` | `confirm()`, `prompt()` |
| Toast (transient notification) | `z-[95]` | dialog-provider toast |
| Context menu / Cmd+K palette | `z-[100]` | timeline ContextMenu, CommandPalette |

Backdrop opacity = **`bg-black/40 backdrop-blur-sm`** ve všech modalech. SidePanel má lehčí `bg-black/20 sm:bg-transparent` (drawer-tier, ne plně blokující).

## Modal pattern checklist

Když přidáváš nový modal, drž tyto principy:

- **ESC closes** — `useEffect` listener na `document` `keydown`
- **Backdrop click closes** — `onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}` na fixed root
- **Body scroll-lock** — `document.body.style.overflow = "hidden"` v effectu, restore na cleanup. Výjimka: `<SpotsDrawer>` (toolbar drawer, koexistuje s page; necháno záměrně)
- **Auto-focus first relevant field** — viz `nameInputRef.current?.focus()` v `<NewSpotModal>` / `<SpotDropModal>`. Pro confirm dialogy fokus jde na confirm/cancel
- **Restore prior focus on close** — `previouslyFocusedRef.current = document.activeElement` na openu, na cleanup `prev.focus()`. Klávesnicový uživatel se vrátí tam, odkud modal otevřel
- **Submit button placement** — současná konvence: footer mimo `<form>`, submit přes `closest("[role=dialog]").querySelector("form").requestSubmit()` choreografii (drží native form validation). Viz `<NewSpotModal>` a `<SpotDropModal>`. Když submit jde uvnitř form, footer musí být uvnitř form taky.

## Hosting & deploy strategie

**Aktuálně:** lokálně přes `npm run dev` na `localhost:3000`. DB = Neon dev project (free tier). Pro občasné sdílení s klientem = **Cloudflare Tunnel** (`cloudflared tunnel --url http://localhost:3000`) — dočasné `*.trycloudflare.com` URL, žádný setup.

**Důvod**: NDA + nevydané PlayStation tituly. Vercel/Neon = third-party USA. Než bude jasno o smlouvě, držet vše lokálně.

**Až bude smlouva** (3 možnosti dle závažnosti NDA):
- **A) Vercel EU + Neon EU** — nejjednodušší, ale třetí strana
- **B) Hetzner VPS (€5/mo) + Coolify** — vlastní HW v EU, "git push → deploy"
- **C) NAS / on-prem** — nejbezpečnější, nejvíc setup. Cloudflare Tunnel pro vnější přístup.

Schema migrace = ručně `npm run db:push` proti prod URL po každé změně schema.ts.

## i18n architektura

- `lib/i18n/messages.ts` — flat key → string dict pro CS i EN, `format()`, `pluralKey()`
- `lib/i18n/server.ts` — `getLocale()` + `getT()` (server, čte cookie)
- `lib/i18n/client.tsx` — `<LocaleProvider>` + `useT()` (client)
- `lib/i18n/country.ts` — `localizedCountryName()` přes `Intl.DisplayNames`
- `lib/theme/server.ts` — `getTheme()` (cookie-based dark mode)
- `app/actions/{set-locale,set-theme}.ts` — server actions

## Co je vědomě **mimo scope**

- ~~Schvalovací workflow~~ → **JE, auth-gated**
- ~~Side panel detail kampaně z timeline~~ → **JE postavený jako peek**
- ~~Spoty jako samostatná entita~~ → **JE, V2.1 shipped** (schema, /spots admin, picker ve formuláři, "spot pending" stav viditelný)
- Lifecycle classification (Pre-launch / Launch / Out now badges, ⭐ marker) — vyhozeno
- "Naked launch" warnings — žádné nudge
- "Příliš brzy/pozdě" labely — žádné judging timing
- Material status / checklist
- Proof tracking (důkaz že to v retailu fakt běželo)
- Priority pole / scoring
- Auto-rules
- IGDB integrace pro auto-fill produktů
- Density modes timeline → **JE postavený** (comfort/compact toggle)
- Auto-mapping barvy
- Release lens / vertical markers (nudge smell)
- REST API navenek, webhooks
- Per-user permissions / role
- **Excel import** — partner explicitně řekl "klientovi neříkat, posílali by chaotické tabulky"

## V2 — co už je hotové (recap)

Z partnerova přepisu jsme za poslední iteraci shippnuli:

1. **Spoty jako samostatná entita** ✅ commits `e39627d`, `0021d3e`, `a3383bd`, `cd61579`
   - Schema: `spots` table (product × country × URL + name + archive)
   - `campaign_video.spot_id NOT NULL` (refaktor z `video_url`)
   - `/spots` admin (4 záložky: Nenasazené default, Nasazené, Všechny, Archiv) + filter řada (search, country, product, sort) + group-by-country toggle (default ON) — škáluje na 100+ spotů bez složek
   - `/spots/new`, `/spots/[id]` edit/archive/delete
   - Campaign formulář má per-country **dropdown z knihovny** + "+ Nový spot" link
   - Dashboard tile "Nenasazené spoty"
   - Filter chip "Bez spotu" v timeline
   - "Spot pending" je viditelný stav (dashed kroužek na barech, amber box v detailu)
   - Migrace dat proběhla idempotentně (1× per DB, scripts už smazaný)

2. **Drag-and-drop spot → timeline → kampaň** ✅ commits `b660c7a`, `f86d992`, `d19d63f`
   - `<SpotsDrawer>` toolbar tlačítko + 320 px slide-out s search + tabs + draggable kartičky (`lib/spot-drop-store.ts` + `SPOT_DRAG_MIME`)
   - Drop targety na každém kanálovém řádku v timeline (`onDragOver` + `onDrop` v `components/timeline.tsx`)
   - **Ghost preview během dragu**: cílový kanál si nafoukne výšku o jednu lane (CSS transition), v té lane se kreslí přerušovaný indigo bar + plovoucí pilulka s CZ daty. Kanály pod cílem se posunou dolů. Country mismatch → preview se neukáže, dropEffect="none".
   - Workaround pro HTML5 spec: `dataTransfer.getData()` není přístupný v `dragover`, proto držíme paralelní `currentDrag` modul state, set v drawer `onDragStart`, read sync v timeline `onDragOver`.
   - `<SpotDropModal>` s pre-fillem (drop date, +14 dní, zaškrtnutý drop kanál + opt-in další ze stejné země, "Schválit hned" toggle)
   - Server action `createCampaignFromSpot(formData)` v `app/spots/actions.ts` (validuje že vybrané kanály jsou v zemi spotu, vytvoří campaign + campaign_channels + campaign_video pro tu zemi)
   - Mismatched země → toast, žádný silent fail

3. **Czech-formatted datum hint** ✅ commit `6d0d815` — `<DateRangeSummary>` pod `<input type="date">` v drop modalu + override dialogu (browser-locale-independent CZ display + dn validace).

4. **toDateInputValue timezone fix** ✅ commit `cd3c75b` — předtím `toISOString().slice(0,10)` v non-UTC timezone shiftoval datumy o den. Teď používá lokální `getFullYear/Month/Date`.

## Audit + plán vylepšení (2026-05)

Tři paralelní audity (consistency / DB / UI) prošly celou code base a vyextrahovali ~40 reálných issues. Plán je rozdělený na tranše seřazené podle priority. Detail viz commity, tady jen přehled stavu.

**🔴 Tier 1 — Kritické bugy (data-integrity, audit, filter-forwarding):** ✅ commit `b669eae`
- Tranše 1: `auditLog ⟕ campaigns` JOIN ve 3 místech (admin/audit/actions+page, components/nav) bez `entity='campaign'` filtru → spot/user id by silently přilepil špatný campaign name v aktivitě. Přidáno `and(entity='campaign', entityId=campaigns.id)`. `channels.country_id`/`chain_id` + `spots.country_id` přepnuté z `cascade` na `restrict` — admin nemůže nedopatřením smazat zemi a vzít s sebou všechny campaign_channels rows.
- Tranše 2: Audit log humanization — `action="approved"` (raw EN slovo) → "schválil(a) kampaň" + volitelná poznámka. `approvalCleared`, `channelOverride`, `channelOverrideCleared` mají vlastní humanized branche místo fallback "upravil(a) kampaň".
- Tranše 3: Filter forwarding — `/api/export/campaigns`, `/print/timeline`, `/share/[token]` nyní propaguji `approval` + `missingSpot` filtry.

**🟡 Tier 2 — Cleanup (high yield, low risk):** ✅
- Tranše 4: Saved-views `ALLOWED_PARAMS` + `createTimelineShareLink` ALLOWED list — drop dead `client`/`communicationType`, **add missing `approval`/`missingSpot`** (reálný bug: ukládání Pohledu silently dropovalo tyhle dva filtry). Schema.ts saved_view komentář aktualizovaný. `summarizePayload` v saved-views-menu má updated label mapu.
- Tranše 5: Dead code/files smazány — `scripts/migrate-video-urls.ts` (legacy migrace), `components/video-player-modal.tsx` (žádný import), `lib/db/schema.ts export const games` alias, `lib/utils.ts dateRangesOverlap`, seed.ts "promote draft to approved" leftover (workflow byl odstraněn dávno).
- Tranše 6: Stale comments — schema.ts spotId migration-window note (backfill je dávno hotový), schema.ts saved_view payload příklad, queries.ts "games" → "products", saved-views-menu header komentář.
- Tranše 7: Server action revalidation — `cancelCampaign`/`reactivateCampaign` přidaly `revalidatePath("/campaigns")`, `deleteProduct` přidalo `revalidatePath("/")` + `/campaigns` (timeline + list zobrazují product name na cards).

**🟢 Tier 3 — Schema hygiena (soft removal — bez DB migrace):** ✅
- Tranše 8: Dropnuto z `schema.ts`: `campaigns.videoUrl` (legacy single-URL-per-campaign, nahradilo `spots.videoUrl` cez `campaignVideos`). Code refs odstraněny — `app/admin/templates/actions.ts` (TemplatePayload + saveCampaignAsTemplate snapshot), `app/campaigns/[id]/actions.ts` (clone), `app/campaigns/new/actions.ts` + `[id]/edit/actions.ts` (insert/update writes), `app/api/export/campaigns/route.ts` (CSV column). Old templates JSONB payload může mít `videoUrl` key — TS type ho neexpectuje, silently ignoruje.
- Tranše 9: Dropnuto z `schema.ts`: `accounts`, `sessions`, `verificationTokens` tabulky (Auth.js Drizzle adapter scaffolding — my používáme JWT-only Credentials, žádný DB session backend) + `users.emailVerified`, `users.image` sloupce. Drizzle relations pro accounts/sessions taky odstraněné.
- Tranše 10: Dropnuto z `schema.ts`: `products.igdbId/slug/rawIgdb/fetchedAt` — IGDB integrace je explicitně v "out of scope".

## Schema drift (Tier 3 soft-removal) — vyřešeno (2026-05)

Při `db:push --force` pro share-link lifecycle (commit `190ac48`) drizzle-kit detekoval všechny Tier 3 orphan sloupce a tabulky a vyhodil je: `account` / `session` / `verificationToken` tabulky, `user.emailVerified` + `image`, `campaign.video_url`, `game.igdb_id` / `slug` / `raw_igdb` / `fetched_at`, `spot.rejected_at` / `rejection_reason` / `rejected_by_id`. **Schéma + DB jsou teď v plném souladu.**

**Recovery při znovuvzniku potřeby**: deklarace v `schema.ts` z gitové historie (`git show HEAD~N:lib/db/schema.ts`) + nový `db:push` znovu vytvoří sloupce/tabulky. Data ze starých orphans jsou pryč, ale ty stejně nikdo nepoužíval.

**🔵 Tier 4 — i18n gaps (CS/EN parita):** ✅
- Tranše 11: Hardcoded CS stringy lokalizované — `saved-views-menu.tsx` (toast/prompt/confirm/empty/aria + summarizePayload labels), `activity-feed.tsx` (`ACTION_VERB` mapa pro CS gendered + EN simple, "Aktivita" header, "Žádná aktivita.", "Zobrazit kompletní audit log", "neznámý"), `campaigns-table.tsx` (3 aria-labels checkboxů), 3× close-button `aria-label="Zavřít"` (route-modal, public-timeline, dialog-provider) → `t("common.close")`, `nav.tsx` Cmd+K tooltip. Nové i18n klíče v `lib/i18n/messages.ts`: `nav.search_shortcut_tooltip`, `activity_feed.*`, `saved_views.*` (~30 klíčů), `campaigns_table.aria.*`.

**🟣 Tier 5 — Vizuální konzistence (polish, větší rozsah):** ✅
- Tranše 12: UI primitivy A+B+C ✅ — extrahované do `components/ui/`:
  - **`<Field label hint required size="sm|md">`** v `components/ui/field.tsx` — sjednotil 4 verze (campaign-form-body, spot-form-body, new-spot-modal, spot-drop-modal). `size="md"` (default) = `text-sm font-medium` label, červená `*` na `text-red-500`. `size="sm"` = `text-xs text-zinc-500` label, pro modaly. `<label>` wrapper pro accessibility.
  - **`<EmptyState title? description cta? variant="dashed|plain">`** v `components/ui/empty-state.tsx` — sjednotil empty states v `/spots`, `/releases`, timeline. Default = dashed-border kontejner; `variant="plain"` pro embedded kontexty (timeline scrollbox).
  - **`<Pill size="xs|sm|md" tone? className?>`** v `components/ui/pill.tsx` — sjednotil StatusBadge, CommunicationBadge, deployment-count chip v `/spots`. Tones: emerald, amber, blue, red, zinc, indigo. Custom palette přes `className` (viz CommunicationBadge co používá `lib/communication.ts` paletu).
  - **NEEXTRAHOVALI jsme** `<Section>` (záměrné rozdíly mezi form section header / table grouper / country banner) a `<PrimaryButton>` (5 paddingů je per kontext, extrakce by replikovala tailwind).
- Tranše 13: Modal pattern unification ✅ — z-index hierarchie sjednocená (drawer 60 < SidePanel 70 < modal 80 < dialog 90 < toast 95 < menu 100, viz "Z-index hierarchy" sekci). public-timeline modal backdrop /50 → /40. SpotDropModal + ChannelOverrideDialog dostaly auto-focus + restore-prior-focus. Submit button pattern dokumentovaný v "Modal pattern checklist".

**⚙️ Tier 6 — Audit/perf:** ✅
- Tranše 14: Audit log gaps zaplněné. Admin user actions (`createUser`/`updatePassword`/`deleteUser`) nyní emitují audit entries s `entity: "user"`, `entityId: 0` (UUID nelze namapovat na integer column) a `changes: { userId, email, … }` aby post-mortem fungoval i po smazání targetu. Admin entity actions (`countries.create/delete`, `chains.create/delete`, `channels.toggle/addChainToCountry`, `products.create/update/delete`) emitují audit entries s `entity: "country"|"chain"|"channel"|"product"` — to co schema komentář deklaroval, ale nikdo nezapisoval. Snapshot pre-delete pro country/chain/product zachycuje data co po smazání jinak zmizí.
- Tranše 15: Perf wins.
  - **Spot deployment count subquery** extrahovaný do `spotDeploymentCountSql()` + `spotIsUndeployedSql()` v `lib/db/queries.ts`. 3 duplikáty → 1 zdroj pravdy.
  - **`findCampaignIds` conditional joins** — fast path bez joinů pro callery co potřebují jen campaign-table columns (`/admin/archive` `onlyArchived`, DashboardStats counts), full join tree jen pro `q`/`countryCode`/`chainCode`. Drizzle `$dynamic()` builder pro conditional `.leftJoin()`.
  - **`/campaigns/[id]/edit` Promise.all** — 3 sekvenční awaity (campaign snapshot, channel rows, video rows) → paralelně. Neon HTTP = každý await je RTT, takže reálná latency win na pomalém spojení.
  - **`DashboardStats.awaitingRows`** — pulloval celé řádky jen pro count + JS bucketing running vs upcoming. Teď `count(*) FILTER (WHERE ...)` partition v SQL = 1 řádek se 2 ints místo N řádků.

## V2 — zbývající plán (po auditu, reordered 2026-05)

Po dokončení Tier 1-6 auditu jsem prošel celý codebase a sestavil priority list, který kombinuje (a) původní partner-driven roadmapu, (b) věci, které jsem v auditu objevil, ale na seznamu nebyly. Partner schválil tuhle reorderaci.

### 🚨 PRIORITA Č. 1 (parkováno, čeká na rozhodnutí partnera) — Sony as in-app user

**Kontext.** Dosud appka modeluje "schvaluje klient" jako abstraktní stav (`spots.clientApprovedAt` + `campaigns.clientApprovedAt`), ale klient (Sony) v appce reálně přihlášený nikdy nebyl — všechno schvaloval kdokoli z agentury jako "editor". To je sémantická lež. Partner po jednání se Sony usoudil, že **Sony se s agenturou v appce reálně potkají**, ale ještě **nejsou dohodnuti, kdo tam co bude dělat**:

- Možná agentura připraví kampaně podle mailového briefu od Sony, Sony jen schvaluje spoty.
- Možná Sony bude kampaně tvořit sám a agentura jen dodává spoty.
- **Pevný bod:** *spot vždy schvaluje Sony*. Schválení kampaně je otevřená otázka.

Living-product strategy — appka má dovolit oba flowy a počkat, který se přirozeně usadí.

**Můj doporučený model (potvrdit s partnerem)** — dvě ortogonální osy uživatele:

1. `users.role ∈ {admin, editor, viewer}` (existuje) — *co kdo umí dělat*
2. `users.isClient` boolean (NEW, default `false`) — *za kým kdo stojí*

Kombinace pokryjí všechny scénáře bez `client_editor` hybrid role:

| Persona | role | isClient | Power |
|---|---|---|---|
| Agency admin | admin | false | Vše kromě "Schvaluji" |
| Agency editor/projekťák | editor | false | Editovat, **ne schvalovat** |
| Sony reviewer | viewer | true | Číst + komentovat + **schvalovat** |
| Sony power-user | editor | true | Vytvářet/editovat + **schvalovat** |

**Server-action gates:**
- `approveSpot`/`unapproveSpot`/`approveCampaign`/`clearCampaignApproval` → nový `requireClient()` helper (ověří `isClient = true`). **Ne `requireEditor()`** jako dnes.
- Ostatní mutace → `requireEditor()` jako dnes (nezávislé na `isClient`).
- `/admin/*` → `requireAdmin()` jako dnes.

**UI:** "Schvaluji" button se renderuje **jen** pro `isClient = true`. Agentura vidí jen aktuální stav (Pill "Čeká"/"Schváleno"), button vůbec ne.

**Schvalování kampaně (`campaigns.clientApprovedAt`)** — nemusí se rozhodovat hned. Stačí, že `approveCampaign` taky půjde přes `requireClient()`. Pak se workflow buď přirozeně používá (Sony to klikne), nebo přirozeně odumře (Sony to ignoruje, šrafy zůstanou věčně, později vyhozeno jako Tier 3 soft-removal). Žádné předčasné lock-down rozhodnutí.

**Co se nemění:**
- DB sloupce `clientApprovedAt` zůstávají s tímhle názvem (sémanticky teď konečně sedí — "klient" = Sony reálně v appce).
- i18n labels "Schvaluji tento spot. Volitelně přidej poznámku." (z předchozí iterace) sedí — Sony to čte ze své perspektivy.
- `requireEditor()` u všech ostatních mutací zůstává.

**Otevřené otázky pro callu s kolegou** (partnerova práce, ne moje):
1. Sony users vidí `/admin/audit`? Default `ne` (interní agency reporting).
2. Sony users vidí cizí kampaně? Default `ano` (jedna agentura, žádný multi-tenant).
3. Komentáře — Sony bude komentovat, @mention agent? Default `ano`, "just works" v aktuálním kódu.

**Implementační odhad** (až bude zelená): ~3 hod čisté práce. Schema migrace (`isClient` ADD column, vyžaduje `db:push --force`), `lib/auth-helpers.ts` extension (nová `requireClient`), `lib/roles.ts` doplnění typu, `auth.config.ts` JWT propagace `isClient`, server actions update (4 server actions přepnout na `requireClient`), UI gates (4 míst kde se "Schvaluji" button renderuje), `/admin/users` create/edit form rozšířit o checkbox, audit log — žádné změny (entries už dnes mají userId, kdo vidí kdo schválil).

### ✅ PRIORITA Č. 2 — Spot vocabulary refactor — SHIPPED (2026-05-06)

Shippnuto v 9 commitech (`7ab8089` → `65c8dab`) ve čtyřech fázích:

- **Phase 1a** `7ab8089` — schema (`spots.production_status` text NOT NULL DEFAULT `'bez_zadani'`) + backfill script + `lib/spot-status.ts` (state machine, derived states, auto-transitions, Pill tones, typed i18n keys). `lib/spot-approval.ts` zachován jako compat shim.
- **Phase 1a-iter** `961879e` → `8c83221` — partner měl výhrady k linear modelu. Po dvou iteracích finální tvar: **Status (5 stages, agency) + Schválení (Sony's separate click) — nezávislé**. Status zahrnuje `ceka_na_schvaleni` + `schvaleno` jako agentura's interní acknowledgment (např. „Sony nám potvrdilo mailem"). Sony's actual click v appce = separátní `clientApprovedAt`. Toggle Status nezpůsobí Sony approval ani naopak. UI: `/spots` list má dva sloupce, detail dvě sekce vedle sebe. Viz "Stav spotu" sekce výš.
- **Phase 1b** `0bebc67` — server actions: `createSpot` / `createSpotForPicker` set initial status by URL presence; `updateSpot` wires `autoTransitionForUrlChange` (URL set → `ceka_na_schvaleni`, URL replaced while `schvalen` → `ceka_na_schvaleni` + wipe approval timestamps); `approveSpot` flips to `schvalen`; `unapproveSpot` rolls back to `ceka_na_schvaleni`/`bez_zadani` based on URL; new `setSpotProductionStatus(spotId, status)` mutator (refuses target = `schvalen`, idempotent, rollback from `schvalen` wipes approval timestamps).
- **Phase 2a** `8593c62` — `<SpotStatusControls>` na `/spots/[id]`: horizontal stepper všech 5 manuálních stavů, current highlight, completed step Check icon, "Schválen" routes through approve prompt, "Zrušit schválení" link když approved. Title pill teď ukazuje plný production status (8 labels), ne binary approved/pending.
- **Phase 2b** `5a25c3f` — timeline bar shrafy přepojené z `campaign.clientApprovedAt` na `spot.productionStatus !== 'schvalen'`. `fetchTimelineCampaigns` pulluje `spotProductionStatus` per (campaign × country). Tooltip rozlišuje "spot není přiřazen" (null) vs "spot není schválen".
- **Phase 2c** `4c19231` — campaign-level "Schvaluji" UI vyhozeno: peek panel pill + footer buttons, timeline context menu, `/campaigns/[id]` header pill + buttons + approver paragraph. Dashboard "Čeká na schválení" tile přepojený na `spot.productionStatus = 'ceka_na_schvaleni'` (počítá per-spot, ne per-campaign), click → `/spots?approval=pending`. `approveCampaign` / `clearCampaignApproval` server actions zůstaly v kódu jako legacy back-compat — nikdo je nevolá, smažeme později.
- **Phase 3a** `7f5580d` — i18n CS: ~110 řádků přejmenovaných labels (top nav, dashboard, planned-spots list, spot detail, form, drop modal, override dialog, context menu, releases, find-slot, admin desc cards, share + print views, plurals).
- **Phase 3b** `b957a1c` — i18n EN paritní s CS: ~94 řádků mirrored.
- **Phase 3c** `65c8dab` — hardcoded CS strings mimo i18n table: timeline pluralCs trio + cell tooltip, command-palette search placeholder + result-type label (`r.type === "campaign"` → "spot", `r.type === "spot"` → "video"), public-timeline empty-state, audit-filter-bar entity dropdown, spots/[id] humanizer, campaigns/[id] humanizeAuditEntry (8 verb labels), admin/templates + admin/archive + admin/products + admin/products/[id] + admin/audit + admin/users role label.

**Slovník v praxi:**
- *Plánovaný spot* (UI) ≡ row v `campaigns` table (DB)
- *Video* / *Kreativa* (UI) ≡ row v `spots` table (DB)
- *Nasazení* (UI, jen v override dialog + šablonách) ≡ row v `campaign_channels` (DB)

**Stav spotu — DVĚ NEZÁVISLÉ OSY** (finální tvar, commit `8c83221`):

- **Status** (interní, agentura řídí; sloupec `spots.production_status`): **5 manuálních stavů**
  `bez_zadani` → `zadan` → `ve_vyrobe` → `ceka_na_schvaleni` → `schvaleno`
  *Všechno manuální editor klika.* I „Schváleno" v tomhle sloupci je agentura's interní záznam (např. „Sony nám to potvrdilo e-mailem") — neznamená automaticky, že Sony reálně klikl v aplikaci.
- **Schválení** (Sony's actual click; sloupec `spots.client_approved_at` timestamp): binární signál — null = neschváleno, set = Sony klikl `Schvaluji` dne X (+ optional comment + approver).
- **Derived deployment-time** (z campaign × today): `naplanovan` / `bezi` / `skoncil` — počítá se per-deployment, jen pokud Sony reálně schválil (`clientApprovedAt` set). Žádný sloupec.

**Klíčové: Status a Schválení jsou nezávislé.** Toggle Status = "Schváleno" *nezpůsobí* `clientApprovedAt` set. Sony klik `Schvaluji` *nezasáhne* do Statusu. Můžou se rozcházet — agent vidí Status = `Schváleno` (potvrzeno mailem), Sony ještě nelogoval. Nebo Sony klikl `Schvaluji`, ale Status zůstává `Ve výrobě` (final cut není hotový).

**Editace každé osy nezávisle:**
- `setSpotProductionStatus(id, status)` — jen Status, žádný side-effect na schválení
- `approveSpot(id, comment)` / `unapproveSpot(id)` — jen `clientApprovedAt`, žádný side-effect na Status

**Auto-rules při edit videoUrl:**
- URL set poprvé na `bez_zadani`/`zadan` → bump Status na `ve_vyrobe` (creative je v práci). Žádný auto-progress přes `ceka_na_schvaleni` → `schvaleno`, ty jsou explicitní agent klik.
- URL replaced AND Sony had approved → wipe `clientApprovedAt`/`approvedById`/`clientApprovedComment` (nová verze, předchozí sign-off neplatí). Status zůstává.

**UI mapping:**
- `/spots` list: dva sloupce — **Status** (5-state portal dropdown picker) + **Schválení** (binary: `[Schváleno][✕]` když approved, `[✓ Schválit]` chip když ne).
- `/spots/[id]` detail: dvě sekce vedle sebe — *Status* (5-step stepper) + *Schválení* (primary `✓ Schválit` button nebo `Zrušit schválení` link s metadaty kdo/kdy/komentář).
- Title row na detailu: produkční Pill vždy + emerald `✓ Schváleno` Pill jen když Sony reálně schválil.
- Timeline bar šrafy: `clientApprovedAt IS NULL` (Sony's signál; deploy-readiness). Status sám se na baru vizuálně neukazuje.
- Dashboard tile "Čeká na schválení": `clientApprovedAt IS NULL`, nezávislé na Status.

**DB unchanged:** `campaigns` / `campaign_videos` / `campaign_channels` table names zůstaly. `campaigns.clientApprovedAt` + `clientApprovedComment` + `approvedById` columns zůstávají v DB jako Tier 3 soft-removal — kód je nečte ani nepíše, sloupce přežívají pro recovery.

**Co NEbylo v rozsahu refaktoru** (otevřeno pro pozdější fázi):
- `/admin/templates` URL nepřejmenované (jen UI label "Šablony nasazení")
- `/spots` URL nepřejmenované (jen UI label "Video knihovna")
- `/campaigns` URL nepřejmenované (jen UI label "Plánované spoty")
- `approveCampaign` / `clearCampaignApproval` legacy server actions zůstaly v kódu — žádný caller je nevolá, ale technický cleanup je separate task
- DB column `campaigns.clientApprovedAt` ne-dropnuto (budoucí Tier 3 cleanup společně s ostatními legacy)

### 🥇 Top 3 — udělat HNED (next batch ~2 dny)

**A. Per-user role (admin / editor / viewer)** ✅ shipped (commit `69ada56`, dashboard polish v `9e07b71`)
- Schema: `users.role text NOT NULL default 'admin'` (default = 'admin' jen pro migration backfill — existující seed user se backfillne na admin; všechny `createUser` INSERTs musí specifikovat role explicitně, jinak by každý nový user dostal admin)
- Auth pipeline: `authorize` v `auth.ts` validuje DB role přes `isValidRole`, propaguje user.role → JWT → session.user.role v `auth.config.ts` callbacks (Edge-safe, žádný DB lookup per request, role z JWT)
- `lib/roles.ts` — Role type, ROLES const, isValidRole guard, roleAtLeast helper, ROLE_LABEL_KEY i18n mapa
- `lib/auth-helpers.ts` — `requireUser()` / `requireRole(min)` / `requireEditor()` / `requireAdmin()` / `getCurrentRole()`. Centralizované, předtím každý actions.ts měl vlastní private helper.
- Server-side gates:
  - `/admin/*` layout volá `getCurrentRole()` → redirect non-admin (defense-in-depth, plus všechny admin/*/actions.ts volají `requireAdmin()`)
  - Campaign mutations (new/edit/cancel/reactivate/clone/archive/approve/override/share/comment) → `requireEditor` (alias `requireUser` pro back-compat)
  - Spot mutations (create/update/archive/delete + drag-drop create + inline picker) → `requireEditor`
  - Bulk campaign actions → `requireEditor`
  - Saved views (personal bookmarks) → `requireUser` (any authed, including viewer)
- UI gates:
  - Nav: `/admin` + `/admin/templates` linky skryté pro non-admin; `/campaigns/new` link skrytý pro viewer
  - `/admin/users`: role select v create formuláři (default editor) + role select per řádek s `updateUserRole(userId, formData)` server action (refuse self-demote pokud bys byl jediný admin)
- i18n: `roles.admin/editor/viewer` (CS: "Admin"/"Editor"/"Pouze čtení", EN: same/Read-only)
- ⚠️ **Vyžaduje `npm run db:push --force`** — tohle je ADD column (soft-removal trick z Tier 3 neplatí pro additions).

**B. Stopáž smyčky** ❌ vyřazeno — partner explicitně řekl "není teď důležité". Pokud někdy přijde, schema `spots.durationSec` + tooltip na barech.

**C. Re-approval po edit** — partner-driven, řeší reálný concern. Aktuálně schválení (`clientApprovedAt`) zůstává po jakékoli editaci kampaně — klient možná schválil verzi A, agent edituje na verzi B, klient o tom neví. Snapshot fields {name, startsAt, endsAt, channelIds, spotsByCountry}, na update porovnat se schváleným snapshotem, kdyby se "podstatně" změnilo → invalidate `clientApprovedAt` + audit entry. ~3 hod.

### 🥈 Po tom — viditelné winy (~1 týden)

**D. Aggregate analytics tile / mini-page** — po Tier 6 audit log loguje všechno, ale UI to neukazuje sumarizovaně. Queries jako "kampaně tento kvartál × stav", "channel utilizace per země", "průměrná délka kampaně" jsou teď jednoduché groupBy. Partner = ukáže klientovi a dělá dojem. ~1 den.

**E. Test infrastructure foundation** — vitest setup, 5-7 smoke testů pro kritické server actions: `createCampaignFromSpot`, `approveCampaign`, `setChannelOverride`, `createSpotForPicker`, `deleteUser`, `updateCampaign`. Nepokrývá vše, ale zachytí regresi v hlavních flowech (drag-drop ghost bug, audit join bug, filter forwarding bug — vše bychom měli teoreticky testem chytit). ~půlden.

**F. Cmd+K → spoty + admin entities** ✅ částečně shipped — Cmd+K teď hledá v spotech (name / product name / videoUrl / country code). Match limit: 6 kampaní + 6 spotů + 3 produkty. Spot result má dot v emerald (schváleno) / amber (čeká) — instantní status v palette. Stále chybí: hledání admin entities (channels / chains / countries) — odložené, nízká priorita.

### 🥉 Polish, až bude prostor

**G. Pagination** — `/campaigns`, `/spots`, `/admin/audit` všechno pulluje vše. Na 50 řádcích fine, na 500+ to bude trapné. Tripwire: implementovat když nějaká tabulka překročí 50 řádků. SpotsDrawer taky — ten pulluje při každém dashboard render. ~3 hod.

**H. Drag-from-releases na timeline** — z původního "wow" seznamu. Reusuje drag-drop pattern (SpotsDrawer + SpotDropModal). Drag release → timeline = vytvoř kampaň pro daný product. ~3 hod.

**I. Activity feed filter** — "moje akce" / "tato kampaň". Bell dropdown teď ukazuje globální feed; ve více-uživatelském režimu (po Tranši A) bude šum. ~2 hod.

**J. Inline edit pro quick changes** — `<EditableCampaignTitle>` pattern existuje. Extendnout na color, status na peek panelu, bez nutnosti přejít na `/edit`. ~3 hod.

### 🧹 Tech debt — rezerva

- **DB migration files** — až bude staging/prod, jeden den setup. Drizzle-kit `generate` místo `push --force`.
- **Hard delete recovery (30-day grace period)** — v dev fázi netřeba, ale v produkci `deleteUser`/`deleteSpot` bez recovery je real risk. Soft-delete s 30-day restore.
- **Constants block v `timeline.tsx`** — `BAR_MIN_WIDTH_PX`, `CLICK_THRESHOLD_PX`, `RESIZE_EDGE_PX` scattered. Drobné hygienické.
- **Drag-resize na barech s override** — aktuálně locked, drag updatuje master. Mohlo by drag updatovat override (ne master) když má override. Discoverability win.

### ❌ Vyhozeno (skip nebo až klient explicitně řekne)

- ~~**AI briefing generator**~~ — wow bez business case
- ~~**Multi-PDF export**~~ — niche, print N× funguje
- ~~**Tisk / banner kampaně**~~ — velký schema refaktor pro niche use case
- ~~**TV/wall mode `/tv`**~~ — kdo to bude koukat
- ~~**iCal feed**~~ — klienti maily/kalendáře nehlídají per kampaň
- **NAS sync** — drží na hosting decisions (ne z roadmapy přímo, ale prakticky čeká)
- **E-mailové notifikace** — SMTP setup + decisions; partner explicitně říká "vizuální nudges stačí pro V1"
- **Release → Campaign hierarchie** — větší refaktor (release jako parent více kampaní); pokud klient nepožádá, není to teď nutné

### ✅ Shipped během auditu (mimo původní seznam)

- Inline `<NewSpotModal>` z campaign formuláře (`<NewSpotModal>` + `<CampaignSpotPickers>` — `createSpotForPicker` returning místo redirect)
- **Dashboard polish** (commit `9e07b71`):
  - **Toolbar reorder** — `[Seznam] [Tisk / PDF] [Sdílet timeline]` ⎮ `[📺 Knihovna] [+ Nová kampaň]`. Dvě skupiny oddělené tenkým dividerem: vlevo read-only navigace, vpravo creation surfaces. Knihovna sedí vedle drawer co otvírá (předtím byla úplně vlevo = oddělená od svého výsledku).
  - **"Aktivita za 7 dní" tile** nahradil statický "Top klient" (jediný klient = konstanta, žádný signal). Sečte campaigns + spots created v posledních 7 dnech přes auditLog `count(*) FILTER` partition v jednom query.
  - **Dismissible `<TimelineTip>`** — dvouřádkový "Tip: drag = posun…" banner má teď `✕` napravo, dismiss persistuje v localStorage `videospots:dismissed:timeline-tip`. SSR-safe (první render ukáže, useEffect pak skryje pokud dismissed). Zpátky přes clear localStorage.
  - **Clickable stat tiles** — "Čeká na schválení" → `/campaigns?approval=pending`, "Nenasazené spoty" → `/spots?view=undeployed`. Jen když count > 0, hover ring + shadow lift = vizuální cue.
- **Spots jako plnohodnotná entita v2** — approval workflow + richer detail (S1 + S3 + S4 z brainstormu):
  - **Dvoustavový workflow**: spot je `pending` (čeká na schválení) nebo `approved`. Žádný "rejected" stav — partner workflow je "spoty se musí schválit před nasazením", takže když klient chce změnu, tým nahraje nové URL (což auto-invaliduje schválení).
  - Schema: `spots.clientApprovedAt`, `clientApprovedComment`, `approvedById`. (Dřívější draft měl ještě `rejectedAt`/`rejectionReason`/`rejectedById` pro 3-state flow — partner odmítl, sloupce zůstaly v DB jako orphan storage per Tier 3 soft-removal pattern.)
  - Server actions: `approveSpot(id, comment?)`, `unapproveSpot(id)`. Každá píše do audit logu, requireEditor.
  - Auto-invalidate při edit URL: `updateSpot` snapshot pre-update; pokud se změnila `videoUrl` a spot byl `approved`, schválení se vyčistí + audit `approvalInvalidatedByEdit: true`.
  - `lib/spot-approval.ts` — `spotApprovalState()` derivace z `clientApprovedAt` (set/null) + `spotApprovalTone()` Pill helper (emerald/amber) + i18n key map.
  - **`/spots` list**: nový sloupec "Schválení" s `<Pill>` (emerald `Schváleno` / amber `Čeká`) + **inline action buttons**: pending řádek má primary `✓ Schválit`, approved řádek má subtle "Zrušit schválení" link. `<SpotApprovalQuickButtons>` client component, prompt na poznámku při schvalování, confirm při zrušení. Filter dropdown "Všechny stavy / Čeká / Schváleno". tabHref preserve approval param.
  - **`/spots/[id]`**: nahoře pill vedle title + dedikovaná Approval section s informací kdo/kdy/komentářem + `<SpotApprovalActions>` (primary `✓ Schválit` button když pending, subtle "Zrušit schválení" link když approved). **Deployment history** rozšířena na past + present (archivované kampaně v sub-section). **Audit log** spotu (last 20) v dedikované sekci s humanized fragments — schválil(a) / vrátil(a) do "Čeká" / upravil(a) URL — schválení automaticky resetováno. (Legacy "zamítl(a)" branch zachován v humanizeru pro staré audit rows z 3-state draftu.)
  - **`<SpotsDrawer>` cards**: barevný dot (emerald/amber) vedle názvu spotu — instantní status bez extra řádku.
  - **`<CampaignSpotPickers>`**: pod dropdown se zobrazí amber warning když picked spot je `pending`. V option labelu je "✓" pro approved, nic pro pending. Není blokující — editor může kampaň naplánovat i s pending spotem (schválení dorazí později).
  - i18n klíče (CS+EN) v `lib/i18n/messages.ts`: `spots.approval.*` (~12 klíčů, simplified z původních ~25), `spots.col.approval`, `spots.filter.approval.*`, `spots.deployment_history.*`, `spots.audit.*`, `spot_picker.warning.pending`.
- **Dashboard polish v1** (commit `51db5b3`) — pure-cosmetic refresh:
  - Header: title `text-3xl → text-2xl`, sub-line `text-sm → text-xs/zinc-500`, `mt-1 → mt-0.5`. Min-w-0 na title cluster.
  - Status trio (LiveRunning/Upcoming/EndingSoon): padding `px-4 py-3 → px-3.5 py-2.5`, header line restructured z "Title: count" do uppercase label + muted count, `border-` → `ring-`, bg saturation backed off `/60`, list items `w-2 → w-1.5` dot, `py-1.5 → py-1`. Right-side meta neutral zinc místo amplifying card's color.
  - Timeline bars: `filter: saturate(0.92)` na bar style — calmer palette bez ztráty identity. Diagonal stripes pro pending: alpha `0.32 → 0.18`, spacing `6/10 → 8/12` — místo "fabric pattern" subtle hatch overlay.
  - StatCard tiles: padding sjednocené, label `text-xs → text-[10px]` tracking-wider, value `text-2xl → text-xl`, sub `text-xs → text-[11px]`.
- **Dashboard polish v2** (commit `f977dc6`) — Lucide ikonky napříč chrome:
  - Status trio: 9×9 colored icon circle vlevo (Play emerald / CalendarDays blue / Clock amber). Animate-ping přesunut z dot na bg kruhu Running tile. Header restruktura na uppercase label + larger count stack.
  - StatCard získal volitelné `icon` + `iconTone` props (emerald/blue/violet/pink/amber/zinc). Wired up: Celkem=Play emerald, Čeká=CheckCircle2 blue, Aktivita=Activity violet, Nenasazené=Megaphone pink.
  - Toolbar: "Seznam" odstraněn (duplikát s top nav), Tisk dostal `Printer`, "+ Nová kampaň" `Plus`, Sdílet `Share2`. SpotsDrawer 📺 emoji → `Bookmark` icon (konzistentní s Lucide stroke aesthetikou).
  - **Top nav active state** v `components/nav-link.tsx`: NavLink přesunut do client componentu s `usePathname()`. Active = bolder text + blue `border-b-2`. Inactive = `border-transparent`, na hoveru jemné `border-zinc-200`. Fixovat po commitu `933634d`: původní absolute-positioned underline na `bottom: -7px` poukazoval pod link; kontejner s `overflow-x-auto` (mobile horizontal scroll) automaticky forsil `overflow-y: auto` a underline trčící ven triggeroval vertical scrollbar v navu. `border-b-2` na linku to fixuje (žádný absolute trick).
- **Share link lifecycle** (commits `190ac48` + `64c0221`) — odkazy `/share/[token]` jsou teď first-class objekty s explicitním lifecycle.
  - **Schema** (`db:push --force`): `share_link.label` TEXT, `share_link.revoked_at` + `revoked_by`. Soft-revoke (řádek zůstává pro audit trail "kdo revoknul, kdy, jaký link"). Bonusem `db:push` uklidil všechny Tier 3 soft-removal orphans, schéma + DB jsou teď synchronizované.
  - **Server actions** v `app/campaigns/[id]/actions.ts`:
    - `createCampaignShareLink(campaignId, { expiresInDays?, label? })` + `createTimelineShareLink(filters, { expiresInDays?, label? })` — povolené presety **7 / 30 / 90 dní**, default 30. Žádné "bez expirace" volby (NDA — každý public link má mít sunset). `normaliseExpiryDays()` defenduje runtime input proti exotickým hodnotám.
    - `revokeShareLink(id)` — idempotentní (revoke už revoknutého linku = no-op + žádný druhý audit row). Audit `changes` payload zaznamená type/label/campaignId, takže entry přežije i když by `share_link` row někdy byl GC'd.
    - `extendShareLink(id, days)` — extenduje od `max(now, currentExpiry)`, takže prodloužení dlouho mrtvého linku dá realnou validitu místo DOA timestampu. Odmítá revoked rows ("vytvoř nový místo unrevoke").
  - **Centralizovaný "active" predikát** v `lib/db/queries.ts`: `shareLinkIsActive(now)` (Drizzle WHERE fragment) + `shareLinkStatus({...}, now)` (active|expired|revoked) — single source of truth, používá `/share/[token]` lookup, per-campaign list i admin page.
  - **UI primitivy**:
    - `<ShareCreateForm>` — sdílený popover (22rem wide, absolutně poziciovaný pod trigger) s expiry chips na jednom řádku + label input. Outside-click + Esc dismiss. `align="left|right"` pro správné anchorování (right pro TimelineShareButton vpravo v toolbaru, jinak left).
    - `<ShareButton>` + `<TimelineShareButton>` mají 3-state machine (idle → configuring → showing). Trigger v configuring stavu zmodří. Předtím inline-flex stlačoval form na ~150px na úzkém toolbaru — popover refaktor v `64c0221` to opravil.
  - **Per-campaign management** — nová sekce "Sdílené odkazy" na `/campaigns/[id]` s `<CampaignShareLinks>` (klient): seznam aktivních odkazů s **Kopírovat / Prodloužit (+30d) / Deaktivovat**, neaktivní pod `<details>` toggle. Server queries do detail page přidají LEFT JOINy pro creator + revoker user (alias `users` table dvakrát).
  - **Audit log**: nové verby `revoked` → "deaktivoval(a)" + `extended` → "prodloužil(a)" v `/admin/audit` ACTION_LABELS i v activity-feed dropdown verb mapě. i18n CS+EN parita v `share_form.*`, `share_links.*`, `admin.share_links.*`, `admin.tab.share_links`, `activity_feed.action.{revoked,extended}`.
- **Chrome ikony polish** (commit `b1af27b`) — sjednocení emoji glyphů s Lucide stroke vocabulary v chrome surfaces. Žádné DB ani behavior změny.
  - **Nové primitivy:**
    - `components/country-badge.tsx` — `<CountryBadge code flag size="xs|sm|md">`. Emoji vlajka v malém zaobleném chipu (`bg-zinc-50 ring-1 ring-zinc-200`). Fallback na 🌐 dot když `flag === null` (nezhroutí layout). Tooltip = ISO kód, `aria-hidden` (název země zůstává v sousedním textu).
    - `components/product-kind-icon.tsx` — `<ProductKindIcon kind className?>`. Mapa product kind → Lucide ikona: game=Gamepad2, console=Monitor, controller=Joystick, accessory=Headphones, service=ShoppingBag, other=Package (fallback).
  - **CountryBadge wired do**: timeline group header, public-timeline (header + bar meta), spots-drawer (sekce + per-card), `/spots` tabulka + sekce, `/spots/[id]` meta, `/campaigns/[id]` (videa + kanály), `/admin/channels` country sloupec, campaign-peek (videa + kanály), channel-override-dialog header (přidán nový `countryCode` prop), spot-drop-modal header.
  - **ProductKindIcon wired do**: campaign-peek product chip, `/campaigns` tabulka, `/spots` tabulka. (V `lib/products.ts` zůstává `kindEmoji()` živá — používá se jinde.)
  - **Záměrně ponecháno emoji**: form `<select>` pickery (channels-picker, campaign-spot-pickers, new-spot-modal, spot-form-body — `<option>` text nemůže renderovat React), `/admin/countries` (správa emoji samotného), `/releases` (kindEmoji je fallback cover-art placeholder), share + print views (paper, simpler), admin product CRUD.
  - **Bell + Search ikony**: 🔔 v `<ActivityFeed>` button → `<Bell>`. 🔍 v ⌘K palette input + nav shortcut hint pill → `<Search>`.

## Klíčové soubory

- `lib/db/schema.ts` — domain model (campaigns + spots + campaignVideos + campaignChannels s overrides + savedViews + ...)
- `lib/db/queries.ts` — `findCampaignIds(filters)` (handles `approval` + `missingSpot`), `fetchTimelineCampaigns` (joinuje channels → countries → campaignVideos → spots → products + JS-side coalesce overrides), `getSpotsByCountry()` (form picker), `getSpotsForDrawer()` (timeline drawer flat list s deployment counts), `getFilterOptions`, `shareLinkIsActive(now)` + `shareLinkStatus({...})` (centralizovaný share-link active/expired/revoked predikát)
- `lib/utils.ts` — formátování, `computedRunState`, `snapToMondayStart`, locale-aware `formatMonthName`
- `lib/i18n/{messages,server,client,country}.ts` + `lib/theme/server.ts`
- `lib/peek-store.ts` — module-level subscriber pro peek panel
- `lib/spot-drop-store.ts` — module-level subscriber pro drag-drop spot → timeline (PendingDrop, SPOT_DRAG_MIME) + `currentDrag` paralelní state pro live preview (HTML5 omezení v dragover)
- `lib/spot-status.ts` — **canonical Status (5 stages) state machine**. `PRODUCTION_STATUSES` = bez_zadani / zadan / ve_vyrobe / ceka_na_schvaleni / schvaleno (vše manuální). `resolveDeploymentTimeState()` per-deployment derived (jen když Sony reálně schválil). `autoTransitionForUrlChange()` (URL set first → bump na ve_vyrobe, jinak no-op), `shouldInvalidateApprovalOnUrlChange()` (URL replaced + was approved → wipe Sony approval; Status unaffected). Pill tones + literal-union typed i18n keys.
- `lib/spot-approval.ts` — **legacy compat shim** s binárním approved/pending API (čte čistě `clientApprovedAt`). Existující call sites se postupně migrují přímo na `clientApprovedAt`.
- `components/spot-status-controls.tsx` — 5-step horizontal stepper na `/spots/[id]` (Bez zadání → Zadán → Ve výrobě → Čeká na schválení → Schváleno). Klik na non-current stav = `setSpotProductionStatus`. Žádná special routing logic; Status je čistě editor's věc.
- `components/spot-status-quick-picker.tsx` — portal-rendered dropdown s 5 Status stavy pro `/spots` list (kompletně escapuje table's overflow-hidden).
- `components/spot-approval-controls.tsx` — Sony's approval primary `✓ Schválit` button (s prompt) / `Zrušit schválení` link na detail page. Vůbec se nedotýká Status.
- `components/spot-approval-cell.tsx` — kompaktní inline cell pro `/spots` list. Renderuje `[Schváleno pill][✕]` když approved (✕ = direct unapprove, no confirm), `[✓ Schválit]` chip když ne.
- `lib/auth-helpers.ts` — `requireUser` / `requireEditor` / `requireAdmin` / `requireRole(min)` / `getCurrentRole`
- `lib/roles.ts` — Role union "admin"|"editor"|"viewer" + helpers
- `lib/communication.ts`, `lib/products.ts`, `lib/colors.ts`
- `lib/campaign-video-form.ts` — `extractSpotsByCountry(formData)` čte `spotId_<countryId>` ze submit
- `components/timeline.tsx` — Gantt + drag + tooltip + ContextMenu + collapsible groups + play button + dashed-circle no-spot marker + density toggle + share-link copy
- `components/public-timeline.tsx` — read-only timeline + bar-click modal s videem
- `components/campaign-peek.tsx` — pravý peek panel (auth)
- `components/side-panel.tsx` — generický shell pro pravé drawery
- `components/channel-override-dialog.tsx` — per-retailer override editor
- `components/campaign-form-body.tsx` — sdílený `/new` + `/edit` form (per-country spot dropdown)
- `components/spot-form-body.tsx` — sdílený form pro `/spots/new` + `/spots/[id]`
- `components/spots-drawer.tsx` — toolbar tlačítko + slide-out s draggable spot kartičkami
- `components/spot-drop-modal.tsx` — modal po drop spotu na timeline (vytvoří kampaň)
- `components/spots-filters.tsx` — URL-driven filtry pro `/spots` (search + country + product + sort + group toggle)
- `components/new-spot-modal.tsx` — inline modal pro vytvoření spotu z campaign formuláře (volá `createSpotForPicker` server action)
- `components/campaign-spot-pickers.tsx` — klientský per-country picker s lokálním stavem (controlled `<select>`, prepend nově vytvořených spotů, auto-select po `<NewSpotModal>` close)
- `components/filter-bar.tsx` — URL-driven filtry + saved views + approval + missingSpot
- `components/saved-views-menu.tsx`
- `components/communication-badge.tsx`, `components/status-badge.tsx`
- `components/country-badge.tsx` — emoji vlajka v rounded chipu (`xs/sm/md`), fallback 🌐 když flag null
- `components/product-kind-icon.tsx` — Lucide ikona pro product kind (Gamepad2/Monitor/Joystick/Headphones/ShoppingBag/Package)
- `components/share-create-form.tsx` — popover formulář pro vytvoření share linku (expiry chips 7/30/90 + volitelný label), sdílený mezi `<ShareButton>` + `<TimelineShareButton>`. `align="left|right"` určuje anchor edge.
- `components/campaign-share-links.tsx` — per-campaign management list pod ShareButton na `/campaigns/[id]` (Kopírovat / Prodloužit / Deaktivovat, neaktivní v `<details>` toggle).
- `components/share-link-admin-actions.tsx` — per-row akce na `/admin/share-links` (mirror `<CampaignShareLinks>` ale server-rendered do tabulkové buňky).
- `components/route-modal.tsx` — generic shell pro intercepting-route modaly
- `components/dialog/dialog-provider.tsx` — Toast + Confirm + Prompt
- `components/locale-switcher.tsx`, `components/dark-mode-toggle.tsx`
- `components/video-embed.tsx`
- `app/@modal/(.)campaigns/new/page.tsx` — intercepting modal pro novou kampaň (jen `/new` zůstal po předchozí stabilizaci)
- `app/api/campaigns/[id]/peek/route.ts` — JSON endpoint pro peek panel (vrací all-countries-with-optional-spot tvar)
- `app/campaigns/[id]/actions.ts` — server actions (clone/cancel/move/archive/**approveCampaign**/**clearCampaignApproval**/**setChannelOverride**/**clearChannelOverride**/**createCampaignShareLink**/**createTimelineShareLink**/**revokeShareLink**/**extendShareLink**/...)
- `app/campaigns/[id]/edit/actions.ts` — `updateCampaign` s diff audit logem (audit klíč `videos` porovnává `<countryId>:<spotId>` arrays)
- `app/campaigns/[id]/page.tsx` — detail + humanizeAuditEntry + approval pill/buttons + per-country spot pending boxes
- `app/spots/{page,actions}.tsx` — knihovna spotů + create/update/archive/unarchive/delete server actions
- `app/spots/{new,[id]}/page.tsx` — create + detail/edit pages
- `app/saved-views/actions.ts`
- `app/admin/share-links/page.tsx` — globální admin přehled veřejných odkazů (status filter chips, status counts cez `count(*) FILTER`, payload type rendering, click-through na kampaň pro campaign-typed odkazy)
- `app/actions/{set-locale,set-theme}.ts`
- `auth.config.ts` — public allow-list (`/sign-in`, `/api/auth`, `/share/`, `/favicon.ico`). **Žádný `/api/share/`** — všechny mutace jsou auth-gated.
- `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg` — defaults. **Žádný `/public/theme-init.js`** (přesunuto na cookie).

## Klíčové npm dependence

- `drizzle-orm` + `@neondatabase/serverless`
- `next-auth` v5 + `@auth/drizzle-adapter`
- `@anthropic-ai/sdk` — AI digest (legacy)
- `qrcode` + `@types/qrcode`
- `bcryptjs`, `zod`, `tailwind-merge`, `clsx`, `date-fns`, `lucide-react`

## Známé fragility / nepevné body

- **Turbopack + intercepting routes + parallel slots** = historicky padalo. Peek panel proto NENÍ intercept, je to imperative store + plain `/api/.../peek` fetch. Modal `/campaigns/new` je intercept, drží.
- **React 19 warning na `<script>` tagy** — proto je dark mode kompletně server-side (cookie + className), žádný inline FOUC script.
- **Drizzle Date parsing** — auto-parsuje sloupce s `mode: "date"`, ne raw `sql<Date>` template. Kdykoliv potřebuješ COALESCE dvou date sloupců, dělej to v JS po `await db.select(...)`.
- **Stale dev server** — když změníš schema.ts a dev server běží, runtime má cached prepared statementy a vidí "column does not exist" i když migrace prošla. Restart dev serveru to vyřeší.
- **Date → "YYYY-MM-DD" musí být LOKÁLNÍ.** `toDateInputValue` v `lib/utils.ts` formátuje přes `getFullYear/Month/Date`, NE přes `toISOString()`. Předchozí ISO verze v non-UTC timezone (CEST = UTC+2) shiftovala lokální půlnoc o den dřív v UTC, takže výstup byl o den vedle. Postihovalo URL params, form pre-fill, drop modal — viz commit `cd3c75b`. Pravidlo: každá funkce která bere lokální Date a vrací string pro zobrazení nebo URL **musí používat lokální komponenty**.
- **`<input type="date">` se rendruje v browser locale**, ne v naší aplikační locale. CZ uživatel s en-US Chrome vidí `2026-05-05`, ne `5. 5. 2026`. Můžeme dát `lang="cs-CZ"` jako hint (browsery to často ignorují) a/nebo přidat Czech-formatted helper line pod input (`<DateRangeSummary>` v drop modalu + override dialogu) — to je co děláme dnes.

## Patterns / konvence pro mutace

Když posíláš mutaci ze **client komponenty** v autorizovaném kontextu (peek panel, context menu, dialog):

1. **Server action volá `revalidatePath(...)`** uvnitř — tím Next.js označí cache stale
2. **Po awaitu volej `router.refresh()`** v client komponentě — vynutí re-render server komponent na aktuální stránce bez full reloadu

Bez kroku 2 server cache je sice invalidovaná, ale běžící klient o tom neví dokud nezavře/otevře stránku. Aplikováno: `approveCampaign` / `clearCampaignApproval` / `cancelCampaign` / `reactivateCampaign` / `setChannelOverride` / `clearChannelOverride` v timeline context menu, peek panel footeru, override dialogu.

Akce co dělají `redirect(...)` (clone, archive) automaticky refreshují přes navigaci, `router.refresh()` tam nepotřeba.

Pro **peek panel**: nezapomeň ještě `refreshCampaignPeek()` (z `lib/peek-store.ts`) — to bumpne `gen` counter a peek si refetchne svoje data nezávisle na server-side refreshi (peek čte přes `/api/campaigns/[id]/peek`, ne přes RSC).

```ts
action={async () => {
  await someServerAction(c.id);
  refreshCampaignPeek();  // peek panel data
  router.refresh();        // server-rendered timeline / detail
}}
```

## Jak otevřít session

```
Pokračuju na videospots, repo C:\Users\johnc\videospots\, branch main.
Přečti AGENTS.md a STAV.md, pak: [zadání].
```
