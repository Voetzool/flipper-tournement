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
- Bundle-doel: < ~60 KB gzip JS (nu ~59 KB, waarvan Dexie het grootste deel).

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
- Undo-knop alleen in het toernooischerm en op het scorebord (`UndoRedo tournamentId=…`). Na elke uitslag een toast
  met "Ongedaan maken" (`showToast(text, action)`).
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
  - `groupSizes(n, max)`: zo gelijk mogelijk, nooit een groep van 1 (10 spelers, max 4 → 4+3+3).
  - `generateRound`: random starts + lokale zoekstappen (spelers wisselen tussen groepen, kasten toewijzen/wisselen).
    Strafscore: W_MEET (al samen gespeeld, kwadratisch) ≫ W_SIZE (vaker in groep van deze grootte dan de speler die
    het minst vaak) > W_MACHINE (kast al gespeeld) > W_MACHINE_TOTAL (kastgebruik spreiden). Pogingen schalen met
    het spelersaantal (32 spelers ≈ 0,2 s per ronde op een laptop).
  - Punten per groepsgrootte (standaard 4: 7/5/3/1, 3: 7/4/1, 2: 7/1). Stand: punten ↓, winsten ↓, gem. plek ↑;
    helemaal gelijk = gelijke rang.
  - Minder kasten dan groepen → groep krijgt `machineId: null` ("Vrije kast").

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
- Schermen: Kasten (zoeken in catalogus of handmatig), `#/kast/:id` (plaatje, rulesheet/Tilt Forums-zoeklink,
  PinballPrimer, IPDB, eigen notities, beste spelers op de kast), toernooi-tab "Kasten" (notities + rulesheet).
- Bronvermelding in de app: "Kastgegevens: OPDB (opdb.org), via Match Play". Licentie van de OPDB-data is niet
  expliciet gevonden; bij twijfel navragen bij OPDB/Match Play.

## Schermen (`src/ui/screens/`)
Toernooien (lijst + back-upherinnering) · Nieuw toernooi · Toernooi (tabs Ronde/Stand/Kasten/Uitslagen, uitslag-sheet,
menu: deelnemers aan/afmelden, afronden/heropenen, verwijderen; "ronde opnieuw indelen" zolang er geen uitslag is) ·
Scorebord (`#/t/:id/scorebord`, wake lock, schaalt met aantal spelers) · Ranglijst (`#/ranglijst`) ·
Spelers (tik → profiel `#/speler/:id`, bewerken via ✎ op het profiel) · Kasten · Meer (back-up
export/import, opslagstatus, installatie-uitleg, versie). Thema in `src/ui/theme.css`.

## Beslissingen (met gebruiker afgestemd)
- Organisator kiest het aantal rondes (extra ronde kan altijd). Rondes worden één voor één ingedeeld.
- Bij restspelers: groepen mengen (niemand zit over).
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
- [ ] **Fase 4** — League/competitie: seizoen met meerdere avonden, punten optellen, slechtste avond(en) laten vallen.

- [x] Undo alleen per toernooi + echt verwijderen van ongebruikte spelers/kasten (feedback na fase 2).

## Werkwijze
- `npm test` en `npm run build` moeten groen zijn vóór een push. Voor UI-wijzigingen: `npx vite preview` +
  Playwright-screenshot (telefoon 400×860 en tablet 1280×800).
- CLAUDE.md bijwerken bij elke fase/beslissing.
