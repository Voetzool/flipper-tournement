# Pinball Tournament op een Raspberry Pi

Dezelfde app als de telefoon-app, maar de gegevens staan op een Raspberry Pi (of andere pc). Alle apparaten die met de
Pi verbonden zijn zien hetzelfde: voer uitslagen in op een iPad of telefoon en laat het scorebord op een laptop of tv
zien. Alles werkt vanzelf bij, zonder te verversen.

> **Nog nooit met een Raspberry Pi gewerkt?** Volg de stap-voor-stap-handleiding:
> https://voetzool.github.io/flipper-tournement/pi/ (ook als bestand: [HANDLEIDING.md](HANDLEIDING.md)).

## Wat heb je nodig
- Een Raspberry Pi met wifi (Pi 3, 4 of 5, of Pi Zero 2 W) en een SD-kaart met **Raspberry Pi OS (Bookworm)**.
- Bij het installeren: internet via een **netwerkkabel**.

## Installeren
1. Zet Raspberry Pi OS op de SD-kaart (Raspberry Pi Imager), start de Pi en sluit de netwerkkabel aan.
2. Open een terminal op de Pi (of log in via ssh) en plak deze regel:

   ```
   curl -fsSL https://voetzool.github.io/flipper-tournement/pi/install.sh | sudo bash
   ```

3. Na een paar minuten staat er "Klaar!" met de naam en het wachtwoord van het wifi-netwerk van de Pi.

Eigen wifi-naam of wachtwoord? Zet ze vóór `sudo bash`:
`curl -fsSL …/install.sh | sudo PINBALL_SSID=Flipperavond PINBALL_WIFI_PASSWORD=geheim123 bash`

## Gebruiken
1. Verbind je iPad/telefoon/laptop met het wifi-netwerk **Pinball-Tournament** (wachtwoord standaard `flipper123`).
2. Open **http://pinball-tournament.local** (lukt dat niet: **http://10.42.0.1**).
3. Scorebord op de laptop: open het toernooi en klik op het scorebord-icoon; zet het venster op volledig scherm.

## Handige commando's (op de Pi)
| Commando | Wat het doet |
|---|---|
| `sudo pinball-tournament update` | Nieuwste versie installeren (gegevens blijven bewaard; Pi heeft dan internet nodig) |
| `sudo pinball-tournament wifi <wachtwoord>` | Wifi-wachtwoord wijzigen |
| `sudo pinball-tournament status` | Kijken of de server draait |
| `sudo pinball-tournament logs` | Laatste meldingen van de server |

De gegevens staan in `/var/lib/pinball-tournament` (met elke dag automatisch een kopie in `backups/`). In de app kun je
via Instellingen → Back-up ook een kopie downloaden of terugzetten.

## Zonder internet
Tijdens een toernooi heeft de Pi geen internet nodig. Machinecatalogus en meegeleverde spelregels staan op de Pi.
Afbeeldingen van machines worden bewaard zodra ze één keer (met internet op de Pi) zijn bekeken. Heeft de Pi via de
netwerkkabel internet, dan kun je in Instellingen de catalogus bijwerken.

## Op een gewone pc
Werkt ook op Debian/Ubuntu: `curl -fsSL …/install.sh | sudo bash -s -- --no-wifi`. Gebruik dan het gewone netwerk.

Voor ontwikkelaars: `npm run build:server` en daarna `npm run start:server` (poort 8080, gegevens in `dist-server/data`).
