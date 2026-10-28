# Pinball Tournament (Flipper Toernooi)

An offline-first web app (PWA) for running small pinball tournaments. It works without internet and keeps all data
on your own device. The app is available in Dutch and English (Settings → *Taal / Language*).

**App:** https://voetzool.github.io/flipper-tournement/

## Features
- Players, machines (with the OPDB machine catalogue, rules and playfield photos) and tournaments.
- Formats: *Group rounds* (groups of 2–4 per machine, points per position), *Round Robin* (1-on-1, everyone plays
  everyone, with a tie-breaker) and *single ranked games* (free for all or teams).
- Glicko-2 rating, ranking and player statistics.
- Scoreboard for a big screen, undo per tournament, backup/restore as a JSON file.

## Install on your phone or tablet
- **Android (Chrome):** open the link → menu ⋮ → *Install app* / *Add to Home screen*.
- **iPhone/iPad (Safari):** open the link → share button → *Add to Home Screen*.

Make a backup now and then via **Settings → Make backup**. The app reminds you once a week (adjustable in Settings).

## Raspberry Pi version
There is also a version that runs on a Raspberry Pi (or another computer) as a server: the data lives on the Pi,
the Pi creates its own Wi-Fi network and every connected phone, tablet and laptop sees the same live data — enter
results on a tablet and show the scoreboard on a TV.

- Step-by-step guide for beginners: https://voetzool.github.io/flipper-tournement/pi/en/ (also as
  [server/MANUAL.md](server/MANUAL.md); Dutch: [server/HANDLEIDING.md](server/HANDLEIDING.md))
- Technical summary: [server/README.md](server/README.md)

## Development
```bash
npm install
npm run dev            # local development server
npm test               # unit tests
npm run build          # production build in dist/
npm run build:server   # Raspberry Pi version in dist-server/
npm run start:server   # run it locally on port 8080
```
