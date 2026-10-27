# CLAUDE.md — Flipper Toernooi

Offline-first PWA voor kleine flipperkast-toernooien. UI-taal: **Nederlands**. De gebruiker is geen ontwikkelaar:
leg keuzes kort en in eenvoudige taal uit en vertel precies wat die zelf moet doen. Vraag bij twijfel in plaats van gokken.

Live: https://voetzool.github.io/flipper-tournement/ · Werkbranch: `claude/sharp-thompson-fr3ldi`

## Stack
- Vite + TypeScript + Preact + @preact/signals (geen router/UI/font-libs; systeemfonts).
- Dexie (IndexedDB) + `navigator.storage.persist()`.
- vite-plugin-pwa (Workbox `generateSW`, `registerType: 'prompt'` → banner "Nieuwe versie").
- Vitest voor unit tests. Playwright (voorgeïnstalleerd in de cloud-omgeving) voor e2e-checks en `npm run icons`.
- `base: '/flipper-tournement/'` in `vite.config.ts` (GitHub Pages-pad). Hash-router (`#/…`, `src/app/router.ts`).
- Bundle-doel: < ~60 KB gzip JS (nu ~89 KB + ~21 KB polyfills; Dexie het grootste deel, Engels ~6 KB, iconen ~10 KB).

## Architectuur: event sourcing
- Elke gebruikersactie = event (`src/events/types.ts`, `EventBody`). Opgeslagen in IndexedDB-tabel `events` (key `seq`).
- State = `buildState(events)` (`src/events/reducer.ts`), puur; alleen events met `reverted: false` tellen.
- Undo/redo (`src/events/store.ts`, `EventStore`) werkt **per toernooi** (gebruikerswens): `undoScope(body)` =
  `tournamentId` of null. Spelers/kasten hebben geen undo (die verwijder/archiveer je handmatig). Undo(t) zet het
  laatste actieve event van t op reverted; redo(t) de eerste reverted van t terug; een nieuwe dispatch verwijdert de
  reverted events met hetzelfde bereik. `TournamentCreated` is niet te undo'en (wel verwijderen; daarna toast
  "Herstellen"). Veilig omdat toernooi-events niet afhangen van latere speler/kast-events en binnen één toernooi de
  stapelvolgorde behouden blijft. Opslag via de `Persistence`-interface (Dexie in de app, `MemoryPersistence` in
  tests). Schrijfacties lopen in een promise-queue.
- Undo-knop alleen in het toernooischerm en op het scorebord (`UndoRedo tournamentId=…`). Na een uitslag géén toast
  meer (gebruikerswens); toasts met actie alleen nog bij verwijderen ("Herstellen").
- **Meerdere vensters** (scorebord op tv via tweede venster): `EventStore.onWritten` seint na elke schrijfactie via
  `localStorage['flipper-sync']`; andere vensters krijgen een `storage`-event en doen `store.reload()` (`state.ts`).
  Werkt ook op iOS 14 (geen BroadcastChannel nodig).
- Spelers/kasten die nooit in een toernooi zaten kun je echt verwijderen (`PlayerDeleted`/`MachineDeleted`, check via
  `playerInUse`/`machineInUse` in de reducer); gebruikte spelers archiveren, gebruikte kasten op inactief.
- Uitslag corrigeren = nieuw event `ResultCorrected` (dus zelf ook te undo'en). Events worden nooit gemuteerd.
- Random uitkomsten (indeling) worden **in het event opgeslagen** (`firstRound`, `RoundGenerated.games`), zodat replay
  deterministisch is.
- **Event-vormen nooit breken**: back-ups bevatten letterlijk de events. Nieuwe velden optioneel maken of een migratie
  in de reducer toevoegen; `schema` staat op elk event.
- `src/app/state.ts`: signals (`events`, `state`), `dispatch/undo/redo`, `describeEvent` (NL-omschrijving voor toasts).
- Meta-tabel: `lastBackupAt`.

## Toernooivormen (plug-ins)
- Interface `FormatDefinition` in `src/formats/types.ts` (`nextRound`, `standings`); registratie in `src/formats/index.ts`.
- Round Robin (`src/formats/roundRobin/`):
  - `groupSizes(n, max)`: zo gelijk mogelijk, nooit een groep van 1 (10 spelers, max 4 → 4+3+3); max 2 + oneven → één wachter.
  - `generateRound`: random starts + lokale zoekstappen (spelers wisselen tussen groepen, kasten toewijzen/wisselen).
    Strafscore: W_MEET (al samen gespeeld, kwadratisch) ≫ W_SIZE (vaker in groep van deze grootte dan de speler die
    het minst vaak) > W_MACHINE (kast al gespeeld) > W_MACHINE_TOTAL (kastgebruik spreiden). Pogingen schalen met
    het spelersaantal (32 spelers ≈ 0,2 s per ronde op een laptop).
  - Punten per groepsgrootte (standaard 4: 7/5/3/1, 3: 7/4/1, 2: 7/1). Stand: punten ↓, winsten ↓, gem. plek ↑;
    helemaal gelijk = gelijke rang.
  - Minder kasten dan groepen → groep krijgt `machineId: null` ("Vrije kast").

- **Round Robin** (intern `headToHead`, `src/formats/headToHead/`): iedereen 1× 1-tegen-1 tegen iedereen.
  Spelersvolgorde wordt bij aanmaken geschud en in `TournamentCreated.playerIds` vastgelegd; schema via cirkelmethode
  (`scheduleRound`, n−1 rondes bij even, n bij oneven → elke ronde één speler "wacht"). Settings hergebruiken
  `RoundRobinSettings` (`maxGroupSize 2`, `pointsTable {2:[1,0]}`). Kasten per ronde: elke kast max 1×, voorkeur voor
  kasten die beide spelers nog niet speelden. Na alle rondes bij gedeelde 1e plaats: één tie-breakpotje
  (`GameDraft.tiebreak: true`) met alle gelijke koplopers op de eerste gekozen kast; telt niet voor punten (wel voor
  rating); de volgorde daarin bepaalt de rangen binnen die groep (`note: 'wint tie-breaker'`). Deelnemers wijzigen,
  extra ronde en opnieuw indelen zijn uitgeschakeld voor deze vorm. Bestaande vorm heet in de UI "Groepsrondes".

- **Losse ranked pot** (intern format `single`, `src/formats/single/`, scherm `src/ui/screens/Single.tsx`, route
  `#/pot` en `#/pot/<vorige pot-id>` voor "Nog een pot"): een "toernooi" met één potje, zodat undo, rating, back-up
  en statistieken gratis meewerken. Naam "Losse pot · <datum tijd>". Iedereen voor zich (uitslag aantikken) of
  **teams** (`GameDraft.teams: Id[][]`, 2 teams, "Teams loten"; uitslag = winnend team eerst, `ResultSheet` toont dan
  "Team A/B wint"). Kast: zelf kiezen of 🎲 willekeurig uit een selectie (`pickRandom`; keuze wordt in het event
  opgeslagen; bij willekeurig bewaart `machineIds` de selectie). Losse potjes staan apart op het startscherm
  ("Losse potjes", laatste 10) en tellen niet als toernooi in de spelersstatistieken.
- `src/events/ranks.ts`: `ranksOf(game)` (plek per speler; teams delen hun plek), `areOpponents`, `placesOf`.
  Rating (`ratings.ts`), `playerStats` en `machineStats` gebruiken dit: teamgenoten zijn geen tegenstanders.

- **Vooruit spelen** (`src/formats/progress.ts`): de volgende ronde mag al ingedeeld worden zodra in de (enige) lopende
  ronde minstens één potje klaar is (max. één ronde vooruit, nooit naar een tie-breaker; `canLookAhead`). Indeling hangt
  niet af van uitslagen. `gameStatus` = done/ready/busy ("speel nu" / "wacht op X" / "kast nog bezet"), puur ter info.
  `RoundTab` toont alle open rondes; verder-knoppen gebruiken `allRoundsComplete`. Scorebord "Nu spelen" = ready-potjes.
  Slimmer vooruit indelen: Groepsrondes `PairingInput.busy` + `W_BUSY` (250, net meer dan één eerste herhaling);
  Round Robin kiest uit de nog niet gespeelde schema-rondes die met de meeste direct speelbare potjes.
- Eerste tab heet "Spelen" (🎮), want bevat toernooien én losse potjes.

## Rating & statistieken (fase 2)
- `src/rating/glicko2.ts`: Glicko-2 (Glickman 2013; getest tegen zijn rekenvoorbeeld). τ = 0.5, start 1500/350/0.06.
  `inflate()` laat RD groeien bij inactiviteit (geeft altijd een kopie terug — aliasing gaf eerder een bug).
- `src/rating/ratings.ts`: `computeRatings(state)` — alle potjes uit alle (niet-verwijderde) toernooien op volgorde
  van `resultAt` (= eerste invoer; correcties veranderen die niet). Elk potje = één ratingperiode; meerspelerpotje =
  paarsgewijze uitslagen tegen de ratings van vóór het potje. Inactiviteit: 1 periode per 30 dagen.
  Voorlopig tot `PROVISIONAL_GAMES` (5) potjes; voorlopige spelers staan apart onderaan de ranglijst.
- Ratings zijn puur afgeleid (signal `ratings` in `src/app/state.ts`), dus undo/correctie werkt vanzelf door.
- `src/stats/playerStats.ts`: potjes, winst%, gem. plek, % verslagen tegenstanders, toernooien/zeges/podium,
  per kast, tegenstanders (erboven–eronder), recente potjes.
- `RatingChart` (eigen SVG): lijn #0e9cbc (gevalideerd met de dataviz-validator op kaartkleur #1b1b2e), band = ±RD,
  tik/beweeg voor tooltip per potje.

## Kasten & catalogus (fase 3)
- **OPDB heeft zijn eigen API op 1 okt 2026 uitgezet.** Data komt nu via Match Play. De bulk-export is gratis en zonder
  token: `https://mp-data.sfo3.cdn.digitaloceanspaces.com/opdb-v2.json` (bron: README van edgiardina/PinballApi en
  dgolja/opdb-to-psql; Match Play vraagt de export te gebruiken i.p.v. per-entry API-calls). Geen GitHub secret nodig.
- `scripts/build-catalog.mjs` (in CI vóór de build) downloadt de export en schrijft via `scripts/catalog-transform.mjs`
  een compacte `public/catalog/opdb.json` + `opdb-meta.json` (versie = hash). Faalt het, dan bouwt de app gewoon
  zonder (nieuwe) catalogus (warning in de log). `public/catalog` staat in .gitignore. Workflow draait ook wekelijks
  (cron, alleen vanaf de standaardbranch).
- Exportformaat (onofficieel schema): `entries[]` met o.a. `opdbId`, `name`, `shortName`, `year`, `type` (em/ss/me),
  `entryType` (machine/alias/machineGroup), `physicalMachine`, `manufacturer.name`, `ipdbId`, `pinballRulesUrl`,
  `pinballPrimerUrl`, `images[].urls.{small,medium,large}`, `keywords`. Groepen en virtuele tafels worden overgeslagen.
- App: `src/catalog/` — catalogus wordt NIET geprecachet (`globIgnores`), maar pas bij gebruik gedownload en in
  IndexedDB (meta-key `catalog`) bewaard → offline zoeken (`searchCatalog`: alle woorden, exacte naam/korte naam eerst).
  Bijwerken via Meer. Kastafbeeldingen (cross-origin) via Workbox runtime cache `kast-afbeeldingen` (CacheFirst).
- `Machine` heeft optioneel: manufacturer, year, kind, notes, rulesheetUrl, primerUrl, ipdbId, opdbId, imageSmall/Medium.
  `MachineUpdated` is een patch (alleen meegegeven velden; `null`/'' = leegmaken). Oude events blijven geldig.
- Schermen: Kasten (zoeken in catalogus of handmatig), `#/kast/:id` (plaatje, knop Spelregels, PinballPrimer/IPDB-
  links, eigen notities, beste spelers op de kast), toernooi-tab "Kasten" (notities + knop Spelregels).
- Bronvermelding in de app: "Kastgegevens: OPDB (opdb.org), via Match Play". Licentie van de OPDB-data is niet
  expliciet gevonden; bij twijfel navragen bij OPDB/Match Play.

## Spelregels (na fase 3, gebruikerswens)
- **Tilt Forums is op 1 sept 2026 gesloten.** De wiki-rulesheets staan nu op pinballrulesheets.com, bron in
  GitHub-repo `heyrocker/pinballrules` (map `docs/<fabrikant>/<naam>.md`, YAML-kop met `title`, `manufacturer`,
  `opdb_id` = OPDB-groep). Licentie **CC0** → we leveren ze mee. ~90 kasten (vooral modern).
- CI: `git clone` van die repo → `scripts/build-rules.mjs` kopieert ze naar `public/rules/<pad>.md` + `index.json`
  (groep → pad); `build-catalog.mjs` zet `rs` (pad) op elke catalogusregel van die groep (alle varianten).
- **The Pinball Primer** (pinballprimer.github.io, ~800 handleidingen, ook klassiekers; OPDB levert de URL als `pp`)
  heeft GEEN licentie → niet meeleveren. De app haalt de pagina op het apparaat zelf op (GitHub Pages staat CORS toe),
  zet hem om naar Markdown (`src/rules/primer.ts`) en bewaart een persoonlijke offline kopie met bronvermelding.
  NB: de maker is fel tegen AI; niets van hun inhoud in de repo of tests zetten.
- `src/rules/rules.ts`: `ensureRules(machineId)` bij toevoegen uit de catalogus; `syncMissingRules()` bij opstarten
  en bij 'online' (ook voor oudere kasten: vult `rulesheetPath`/`primerUrl` aan uit de catalogus). Opslag als
  `MachineUpdated { rules: { source, url, text, fetchedAt } }` → in back-ups en offline beschikbaar.
- `src/rules/markdown.ts`: eigen kleine, veilige Markdown-renderer (escapet alles, geen ruwe HTML/afbeeldingen,
  alleen http(s)-links, kramdown-ankers `{#id}` → interne scroll-links via `data-anchor`, BBCode `[details]` weg).
- Scherm `#/kast/:id/regels` (knop "📖 Spelregels" op kastpagina en in toernooi-tab Kasten): huisregels bovenaan,
  dan de spelregels, bron + "opnieuw ophalen". `rules/**` en `catalog/**` niet in de precache.
- Speelveldfoto: catalogus-velden `pm`/`pl` (OPDB image `type: 'playfield'`, medium/large) → `Machine.playfieldMedium/
  playfieldLarge`. Bovenaan de spelregels + zwevende knop "🗺️ Speelveld" → `ImageViewer` (zoom 1×/2×/3×, knijpen).
  Oudere kasten: `syncPlayfields()` (opstarten, 'online', na catalogus bijwerken) vult URL's aan uit de lokale catalogus
  en prefetcht de foto (runtime cache `kast-afbeeldingen`).

## Weergave (lichte modus)
- `src/app/settings.ts`: `theme` ('auto'|'light'|'dark') in localStorage (per apparaat, niet in back-up). Zet
  `data-theme` op `<html>` altijd op 'light' of 'dark' ('auto' volgt `prefers-color-scheme`, live) + `<meta theme-color>`.
  `initSettings()` vóór de eerste render. Keuze in Meer → Weergave.
- `theme.css`: donkere waarden op `:root`, lichte op `:root[data-theme='light']`. Nooit kleuren hard coderen: gebruik
  de variabelen (o.a. `--topbar-bg`, `--nav-bg`, `--overlay`, `--shadow`, `--sb-row-bg`, `--sb-glow`, `--chart`, `--img-bg`).
  Grafieklijn licht #0b7390 (dataviz-validator op #ffffff). Gloed-effecten uit in licht.

## Talen (NL/EN, stap 4 van 4)
- `src/app/settings.ts`: `lang` ('nl'|'en') in localStorage; standaard NL, Engels als de telefoon niet op Nederlands
  staat. Keuze in Meer → "Taal / Language". Zet `<html lang>`.
- `src/i18n/index.ts`: `tr('Nederlandse tekst', { naam })` — de Nederlandse tekst is de sleutel, `{x}` = placeholder,
  ontbreekt een vertaling dan blijft het Nederlands. `locale()` voor datums, `ordinal(n)` voor plekken (3e / 3rd).
  Functie heet `tr` (niet `t`, dat is al de toernooi-variabele). Engels staat in `src/i18n/en.ts`.
- Nieuwe tekst in de UI? Altijd `tr('…')` gebruiken en de Engelse vertaling in `en.ts` zetten. `tests/i18n.test.ts`
  faalt bij een ontbrekende of ongebruikte vertaling of verschillende placeholders. Teksten die via een variabele
  vertaald worden (labels, foutmeldingen uit backup/catalogus) moeten letterlijk in de code staan.
- Bewust niet vertaald: spelregels zelf, namen van spelers/kasten/toernooien (ook opgeslagen "Losse pot · …"-namen),
  eigen notities, het PWA-manifest.

## Oudere apparaten & iconen (feedbackronde na stap 4)
- Moet werken op **iOS 14.5** (iPad Air 2 van de gebruiker): `build.target ['es2020','safari14']` + `cssTarget`;
  `@vitejs/plugin-legacy` met alleen `modernPolyfills` (core-js, ~21 KB gzip extra, geen legacy-bundel). Geen `structuredClone`
  (gebruik `clone()` uit `src/lib/clone.ts`), `.at()`, `Object.hasOwn`, `findLast`, `toSorted` — `tests/compat.test.ts`
  bewaakt dit. `dvh` altijd met `vh`-fallback ervoor. Vangnet in `main.tsx` (error/unhandledrejection) en
  `ErrorBoundary` rond elk scherm (`App.tsx`, key = route): foutmelding + stack + versie + userAgent i.p.v. leeg scherm.
  Instellingen → Over: bouwdatum + knop "Controleren op update" (`checkForUpdate()` in `pwa.ts`).
  Controle gedaan met `eslint-plugin-compat` (browserslist `ios_saf >= 14`): alles wat ontbreekt is afgevangen.
- **Alle** iconen (geen emoji meer in de UI): Material Symbols Rounded (Apache 2.0) als inline SVG in `src/ui/components/Icon.tsx` (`<Icon name fill?>`),
  paden gekopieerd uit npm `@material-symbols/svg-400` (geen runtime-afhankelijkheid). Onderbalk met M3-"pill" bij
  de actieve tab; topbar-knoppen en plusknop (`.fab`, grid-gecentreerd) gebruiken ook `Icon`.
- Geen tekstcursor/selectie bij tikken: `user-select: none` + `caret-color: transparent` op `body`; velden, spelregels
  en notities blijven selecteerbaar.
- Teksten: in het Nederlands heet een kast overal **"machine"** (gebruikerskeuze; interne namen/routes blijven
  `kast(en)`), tab "Meer" heet **"Instellingen"**, knop "Ronde {n}" (geen "indelen").
- Afronden → naar `#/t/:id/stand` met winnaarsbanner bovenaan; `#/t/:id` zonder tab opent een afgerond toernooi op
  Stand (`TabRoute 'auto'`), de tab Ronde linkt naar `#/t/:id/ronde`.
- Uitslag-sheet: plek 1 groen met vinkje (`.order-btn.win`), overige plekken neutraal; bij teams verliezend team vaag.

## Pi-versie (server-modus, `server/`)
- Zelfde app, gebouwd met `vite build --mode server` (`SERVER_MODE` in `src/lib/serverMode.ts`): base `/`, geen
  service worker (`VitePWA disable`), polyfills blijven. Data op de server; de telefoon-app (GitHub Pages) blijft los.
- Server: `server/app.ts` (`node:http`, geen dependencies, Node ≥ 18), gebundeld met `vite.server.config.ts` tot
  `dist-server/server.mjs` + `dist-server/public/`. Hergebruikt `EventStore` met `FilePersistence` (`events.json`
  atomisch + dagelijkse kopie in `backups/`, 14 bewaard) en `MetaFile` (`meta.json`).
- API: `GET /api/events` → `{version, events}`; `POST /api/command` `{op: dispatch|undo|redo|replaceAll}`;
  `GET /api/stream` (SSE, stuurt `version` bij elke wijziging); `GET/PUT /api/meta/:key` (alleen `lastBackupAt` gaat
  naar de server, catalogus blijft per apparaat in IndexedDB); `GET /img?u=` (alleen opdb.org/digitaloceanspaces,
  bewaard in `DATA_DIR/img`); `GET /api/fetch?u=` (alleen pinballprimer.github.io); `POST /api/catalog/update`
  (OPDB-export → `DATA_DIR/catalog`, gaat vóór de meegeleverde `/catalog/`).
- Client: `src/app/remoteStore.ts` (`RemoteStore`, zelfde methodes als `EventStore`): optimistisch lokaal (spiegel-
  `EventStore`), wachtrij naar de server (bij netwerkfout opnieuw proberen), daarna en bij elk SSE-signaal de events
  van de server laden (server wint). `serverConnected` → banner "Geen verbinding met de server" in `Shell`.
  Afbeeldingen via `imgUrl()`, Primer via `remoteUrl()`.
- Installatie: `server/install.sh` (CI zet hem met `pinball-tournament.tar.gz` op Pages onder `/pi/`):
  `curl -fsSL https://voetzool.github.io/flipper-tournement/pi/install.sh | sudo bash`. Node uit apt, systemd-service
  op poort 80 (`CAP_NET_BIND_SERVICE`, gebruiker `pinball`), hostname `pinball-tournament` (+avahi → `.local`), wifi-AP
  via NetworkManager (`pinball-ap`, SSID `Pinball-Tournament`, ww `flipper123`, 10.42.0.1, `ipv4.method shared`,
  dnsmasq-regel voor `pinball-tournament.local`). Opties `--no-wifi`, `--update`, `--dry-run`. Hulpcommando
  `sudo pinball-tournament update|wifi|status|logs|restart`. Uitleg voor de gebruiker: `server/README.md`.
- Beginnershandleiding: `server/HANDLEIDING.md` (Pi 4/5, manier A met scherm en manier B via ssh, problemen oplossen).
  `scripts/build-handleiding.mjs` (eigen mini-Markdown met codeblokken + kopieerknop) maakt er in CI
  `dist/pi/index.html` van → https://voetzool.github.io/flipper-tournement/pi/ (niet in de precache: `pi/**`).
  Link in de telefoon-app: Instellingen → Raspberry Pi-versie. Commando's/namen gelijk houden met `install.sh`.
- Tests: `tests/server.test.ts` (eigen `server/tsconfig.json` met Node-types; root-tsconfig sluit die test uit).

## Schermen (`src/ui/screens/`)
Toernooien (lijst + back-upherinnering) · Nieuw toernooi · Toernooi (tabs Ronde/Stand/Kasten/Uitslagen, uitslag-sheet,
menu: deelnemers aan/afmelden, afronden/heropenen, verwijderen; "ronde opnieuw indelen" zolang er geen uitslag is) ·
Scorebord (`#/t/:id/scorebord`, wake lock, schaalt met aantal spelers) · Ranglijst (`#/ranglijst`) ·
Spelers (tik → profiel `#/speler/:id`, bewerken via ✎ op het profiel) · Kasten · Meer (back-up
export/import, opslagstatus, installatie-uitleg, versie). Thema in `src/ui/theme.css`.

## Beslissingen (met gebruiker afgestemd)
- Organisator kiest het aantal rondes (extra ronde kan altijd). Rondes worden één voor één ingedeeld.
- Bij restspelers: groepen mengen (niemand zit over) — behalve bij **max 2 per kast en een oneven aantal**: dan wacht
  er elke ronde één speler (0 punten), om de beurt (wie de meeste potjes speelde wacht; gelijk → loten).
  `waitingPerRound`/`fairRoundCounts` in `pairing.ts`: het aanmaakscherm raadt dan een veelvoud van n rondes aan
  (iedereen wacht even vaak, speelt evenveel potjes), zet dat automatisch tot de gebruiker zelf het aantal wijzigt,
  en waarschuwt bij een ander aantal. "Wacht deze ronde" wordt bij beide spelvormen getoond (ook op het scorebord).
- Punten per plek staan bij het aanmaken achter de knop "Punten aanpassen" (sheet), niet meer in het hoofdformulier.
- Puntentabel per groepsgrootte, instelbaar per toernooi.
- Repo is openbaar (GitHub Pages gratis). Deploy vanaf `main` én de werkbranch.
- Back-up = alleen actieve events (redo-stapel niet). Herinnering na 7 dagen of na een afgerond toernooi zonder back-up.
- Export via Web Share (telefoon) met download als fallback.
- Tegenstanders-spreiding gaat voor kast- en groepsgrootte-spreiding (gemiddelde punten bij 4 en 3 spelers zijn gelijk: 4).

## Fases / voortgang
- [x] **Fase 1** — PWA/offline, eventlog + undo/redo, spelers, simpele kasten (alleen naam), Round Robin, stand,
      geschiedenis/correctie, scorebord, back-up, GitHub Pages-deploy, unit tests.
- [x] **Fase 2** — Glicko-2 rating, ranglijst, spelersprofiel met statistieken en ratingverloop. Logo (icon.svg) i.p.v. 🎰.
- [x] **Fase 3** — kastencatalogus (OPDB), kastdetails/notities/rulesheet, info-tab "Kasten" in toernooi.
- [ ] **Fase 4** (geparkeerd door gebruiker) — League/competitie: seizoen met meerdere avonden, punten optellen, slechtste avond(en) laten vallen.

- [x] Pi-versie: server op Raspberry Pi met eigen wifi, data op de Pi, live bijwerken tussen apparaten.
- [x] Vooruit spelen in de volgende ronde + tab "Spelen".
- [x] Losse ranked pot (iedereen voor zich of teams, kast zelf of willekeurig uit selectie).
- [x] Feedbackronde: iOS 15-fix, Material-iconen, geen tekstcursor, afronden → Stand, winnaar groen, tabnamen.
- [x] Engels als tweede taal (stap 4 van 4).
- [x] Nieuwe spelvorm Round Robin 1-tegen-1 met tie-breaker (stap 3 van 4).
- [x] Speelveldfoto bij spelregels (stap 2 van 4).
- [x] Lichte modus (stap 1 van 4 uit feedback-ronde; volgende: nieuwe 1-tegen-1
      "Round Robin" (bestaande vorm heet dan "Groepsrondes", interne id blijft `roundRobin`), Engels).
- [x] Spelregels automatisch ophalen en offline tonen (Pinball Rulesheets + PinballPrimer).
- [x] Undo alleen per toernooi + echt verwijderen van ongebruikte spelers/kasten (feedback na fase 2).

## Werkwijze
- `npm test` en `npm run build` moeten groen zijn vóór een push. Voor UI-wijzigingen: `npx vite preview` +
  Playwright-screenshot (telefoon 400×860 en tablet 1280×800).
- CLAUDE.md bijwerken bij elke fase/beslissing.
