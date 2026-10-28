# Pinball Tournament on a Raspberry Pi

The same app as the phone app, but the data is stored on a Raspberry Pi (or another computer). All devices connected
to the Pi see the same thing: enter results on an iPad or phone and show the scoreboard on a laptop or TV.
Everything updates automatically, without refreshing.

> **Never used a Raspberry Pi before?** Follow the step-by-step guide:
> https://voetzool.github.io/flipper-tournement/pi/en/ (also as a file: [MANUAL.md](MANUAL.md)).
> Nederlandse handleiding: https://voetzool.github.io/flipper-tournement/pi/ ([HANDLEIDING.md](HANDLEIDING.md)).

## What you need
- A Raspberry Pi with Wi-Fi (Pi 3B+, 4 or 5, or Pi Zero 2 W) and an SD card with **Raspberry Pi OS (Bookworm or
  newer)**.
- While installing: internet through a **network cable**.

## Install
1. Put Raspberry Pi OS on the SD card (Raspberry Pi Imager), start the Pi and connect the network cable.
2. Open a terminal on the Pi (or log in with ssh) and paste this line:

   ```
   curl -fsSL https://voetzool.github.io/flipper-tournement/pi/install.sh | sudo bash
   ```

3. After a few minutes you'll see "Klaar!" ("Done!") with the name and password of the Pi's Wi-Fi network.
4. Restart the Pi: `sudo reboot`.

Your own Wi-Fi name or password? Put them before `bash`:
`curl -fsSL …/install.sh | sudo PINBALL_SSID=PinballNight PINBALL_WIFI_PASSWORD=secret123 bash`

## Use
1. Connect your iPad/phone/laptop to the Wi-Fi network **Pinball-Tournament** (default password `flipper123`).
2. Open **http://pinball-tournament.local** (if that doesn't work: **http://10.42.0.1**).
3. Scoreboard on the laptop: open the tournament and click the scoreboard icon; make the window full screen.

## Useful commands (on the Pi)
| Command | What it does |
|---|---|
| `sudo pinball-tournament update` | Install the latest version (data is kept; the Pi needs internet) |
| `sudo pinball-tournament wifi <password>` | Change the Wi-Fi password |
| `sudo pinball-tournament status` | Check whether the server is running |
| `sudo pinball-tournament logs` | Latest messages from the server |
| `sudo pinball-tournament restart` | Restart the server |

The data is stored in `/var/lib/pinball-tournament` (with an automatic daily copy in `backups/`, the last 14 are
kept). In the app you can also download or restore a backup via Settings → Backup.

## Without internet
During a tournament the Pi does not need internet. The machine catalogue and the bundled rules are stored on the Pi.
Machine images are kept once they've been viewed while the Pi had internet. When the Pi has internet through the
network cable, you can update the catalogue in Settings.

## On a regular computer
Also works on Debian/Ubuntu: `curl -fsSL …/install.sh | sudo bash -s -- --no-wifi`. Then use your normal network.

For developers: `npm run build:server` and then `npm run start:server` (port 8080, data in `dist-server/data`).
Installer options: `--no-wifi`, `--update`, `--dry-run`.
