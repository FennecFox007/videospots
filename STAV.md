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
- `auditLog` (userId nullable — historicky pro public approve, dnes vždy auth), `comments`, `shareLinks`, `campaignTemplates`

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
- `/admin/{countries,chains,channels,products,users,templates,import,archive,audit}` — interní CRUD.
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

## V2 — zbývající plán (z partnerovy schůzky)

**Diskutované, partner+kolega potvrdili odložit:**

1. **Inline modal pro `/spots/new`** z campaign formuláře — místo "otevřít v nové záložce + refresh" by se otevřel modal, po uložení by se nový spot rovnou objevil v dropdownu. Hezčí UX.
2. **NAS sync** — automatický pull spotů z NAS adresáře (jmenná konvence pro country/chain mapping). Závislé na hosting strategii.
3. **E-mailové notifikace** — SMTP (Atlas/Mailgun/Resend), upozornění na blížící se kampaně, schválení čeká, atd. _V V1 máme jen vizuální nudges (šrafování, dashed kroužky, filter chips, dashboard tiles, activity feed) — to partner akceptuje._
4. **Release → Campaign hierarchie** — release jako parent kampaní (více kampaní per release: Pre-order, Launch, …). Aktuálně jsou kampaně samostatné, release = product.releaseDate informativně.
5. **Stopáž smyčky** — spot má délku v sekundách, timeline ukazuje "ve smyčce máš 90s, mohlo by se hodit dalších 20s".
6. **Re-approval po edit** — schválení je teď trvalé, V2 možná snapshot + invalidate.
7. **Multi-PDF export** (víc kampaní v jednom souboru)
8. **Per-user permissions / role**
9. **Tisk / banner kampaně** — rozšíření modelu mimo video.

**Wow upgrades pro klientské demo (volitelné):**

- AI briefing generator
- iCal feed (klient subscribuje v kalendáři)
- TV/wall mode (`/tv` velkoformátový view)
- Smart NL search v Cmd+K přes Claude API
- Drag-from-releases na timeline

## Klíčové soubory

- `lib/db/schema.ts` — domain model (campaigns + spots + campaignVideos + campaignChannels s overrides + savedViews + ...)
- `lib/db/queries.ts` — `findCampaignIds(filters)` (handles `approval` + `missingSpot`), `fetchTimelineCampaigns` (joinuje channels → countries → campaignVideos → spots → products + JS-side coalesce overrides), `getSpotsByCountry()` (form picker), `getSpotsForDrawer()` (timeline drawer flat list s deployment counts), `getFilterOptions`
- `lib/utils.ts` — formátování, `computedRunState`, `snapToMondayStart`, locale-aware `formatMonthName`
- `lib/i18n/{messages,server,client,country}.ts` + `lib/theme/server.ts`
- `lib/peek-store.ts` — module-level subscriber pro peek panel
- `lib/spot-drop-store.ts` — module-level subscriber pro drag-drop spot → timeline (PendingDrop, SPOT_DRAG_MIME) + `currentDrag` paralelní state pro live preview (HTML5 omezení v dragover)
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
- `components/filter-bar.tsx` — URL-driven filtry + saved views + approval + missingSpot
- `components/saved-views-menu.tsx`
- `components/communication-badge.tsx`, `components/status-badge.tsx`
- `components/route-modal.tsx` — generic shell pro intercepting-route modaly
- `components/dialog/dialog-provider.tsx` — Toast + Confirm + Prompt
- `components/locale-switcher.tsx`, `components/dark-mode-toggle.tsx`
- `components/video-embed.tsx`
- `app/@modal/(.)campaigns/new/page.tsx` — intercepting modal pro novou kampaň (jen `/new` zůstal po předchozí stabilizaci)
- `app/api/campaigns/[id]/peek/route.ts` — JSON endpoint pro peek panel (vrací all-countries-with-optional-spot tvar)
- `app/campaigns/[id]/actions.ts` — server actions (clone/cancel/move/archive/**approveCampaign**/**clearCampaignApproval**/**setChannelOverride**/**clearChannelOverride**/**createCampaignShareLink**/...)
- `app/campaigns/[id]/edit/actions.ts` — `updateCampaign` s diff audit logem (audit klíč `videos` porovnává `<countryId>:<spotId>` arrays)
- `app/campaigns/[id]/page.tsx` — detail + humanizeAuditEntry + approval pill/buttons + per-country spot pending boxes
- `app/spots/{page,actions}.tsx` — knihovna spotů + create/update/archive/unarchive/delete server actions
- `app/spots/{new,[id]}/page.tsx` — create + detail/edit pages
- `app/saved-views/actions.ts`
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
