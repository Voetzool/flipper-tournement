# Changelog

Version numbers: **1.0.x** for fixes and small tweaks, **1.x.0** for new features, **x.0.0** for big changes.
The version is shown in the app under Settings → About.

## 1.1.0 — 2026-11-12

- **Update the Raspberry Pi from the app**: Settings → About → Check for updates → Update the Pi (with the network
  cable plugged into the Pi). All connected devices reload by themselves once the new version runs.
  A Pi installed before 1.1.0 needs one last `sudo pinball-tournament update` first.

## 1.0.0 — 2026-11-12

First full version. Everything built so far:

- **Tournaments**: *Group rounds* (groups of 2–4 per machine, fair pairing, points per position, waiting player with
  odd numbers), *Round Robin* (1-on-1, everyone against everyone, tie-breaker), playing a round ahead, scoreboard for
  a big screen (also live in a second window), undo/redo per tournament, result correction.
- **Single ranked games**: free for all or teams (from 3 players), machine chosen or drawn at random.
- **Rating & ranking**: Glicko-2, player profiles and statistics, ranking as table, bar chart or history,
  export as CSV or image.
- **Machines**: OPDB catalogue (via Match Play), photos, own notes, rules (Pinball Rulesheets bundled,
  PinballPrimer saved offline), playfield photo with zoom.
- **Organising**: regular group of players, archive, folders, list or grid home screen.
- **App**: works offline (PWA), backup/restore with weekly reminder (adjustable), light/dark mode, Dutch and English,
  Material icons, works on older iPads (iOS 14).
- **Raspberry Pi version**: server with its own Wi-Fi network, data on the Pi, live updates on all devices,
  one-line installer, step-by-step guides in Dutch and English.
