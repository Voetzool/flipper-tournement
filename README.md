# Flipper Toernooi

Offline-first web-app (PWA) voor het organiseren van kleine flipperkast-toernooien.
Werkt zonder internet, alle gegevens blijven op je eigen apparaat.

**App:** https://voetzool.github.io/flipper-tournement/

## Installeren op je telefoon/tablet
- **Android (Chrome):** open de link → menu ⋮ → *App installeren* / *Toevoegen aan startscherm*.
- **iPhone/iPad (Safari):** open de link → deelknop → *Zet op beginscherm*.

Maak regelmatig een back-up via **Meer → Back-up maken**.

## Ontwikkelen
```bash
npm install
npm run dev      # lokale ontwikkelserver
npm test         # unit tests
npm run build    # productie-build in dist/
```
Elke push naar `main` (of de werkbranch) wordt automatisch getest en gepubliceerd via GitHub Actions.
Zie `CLAUDE.md` voor architectuur en voortgang.
