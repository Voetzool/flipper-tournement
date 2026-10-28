# Installing Pinball Tournament on a Raspberry Pi

This guide is for someone who has **never** used a Raspberry Pi before. It works for a
**Raspberry Pi 3B+, 4 or 5**. It takes about **30 minutes**. You don't need to program anything: you paste one line
of text and the rest happens automatically.

When you're done, the Pi creates its own Wi-Fi network. Phones, iPads and laptops connected to it open the app at
**http://pinball-tournament.local**. All data is stored on the Pi, and every screen updates automatically.

> Tip: open this page on your phone so you can read along while you work.

## What you need

| What | Notes |
|---|---|
| **Raspberry Pi 3B+, 4 or 5** | Any memory size is fine; the 1 GB of the Pi 3B+ is enough. |
| **Official power supply** | Pi 3B+: the 5 V / 2.5 A micro-USB supply. Pi 4: the 15 W USB-C supply. Pi 5: the 27 W USB-C supply. A phone charger often does **not** work well. |
| **microSD card** | At least 16 GB, preferably marked "A1" or "A2" (faster). |
| **SD card reader** | To prepare the card on your laptop (some laptops have one built in). |
| **Network cable** | To connect the Pi to the internet (your router) while installing. |
| **Laptop or PC** | Windows or Mac. |
| Case (optional) | Protects the Pi. For a Pi 5 a case with a fan is handy. |

There are **two ways** to control the Pi the first time. Pick one:

- **Option A — with a screen**: you connect a screen (or TV), keyboard and mouse to the Pi. You also need an HDMI
  cable, plus a USB keyboard and mouse. Mind which cable:
  - **Pi 3B+**: a **regular HDMI cable** (like for a TV).
  - **Pi 4 and 5**: a **micro-HDMI cable** (the small connector).
- **Option B — from your laptop**: the Pi doesn't need a screen; you control it remotely from your laptop. Your
  laptop must be on the same (home) network as the Pi.

Not sure? Choose **option A**: you'll see exactly what's happening.

## Step 1 — Prepare the SD card (on your laptop)

The SD card is the Pi's "hard drive". First we put the operating system (Raspberry Pi OS) on it.

1. Download and install **Raspberry Pi Imager** from **https://www.raspberrypi.com/software/**.
2. Put the microSD card in your laptop (using the card reader if needed).
3. Start Raspberry Pi Imager and choose:
   - **Device**: Raspberry Pi 3, Raspberry Pi 4 or Raspberry Pi 5 (whichever you have; a 3B+ counts as
     Raspberry Pi 3).
   - **Operating System**:
     - option A: **Raspberry Pi OS (64-bit)**;
     - option B: choose **Raspberry Pi OS (other)** and then **Raspberry Pi OS Lite (64-bit)**.
   - **Storage**: your SD card. Note: everything already on the card will be erased.
4. Click **Next**. Imager asks whether you want to customise the settings: choose **Edit settings** (or
   "Customisation") and fill in:
   - **Hostname**: `pinball-tournament`
   - **Username and password**: make them up yourself, for example username `flipper`. **Write them down!** You'll
     need them later.
   - **Wi-Fi**: **leave empty**. The Pi will create its own Wi-Fi network later.
   - **Time zone** and **keyboard layout**: the ones you use (e.g. Europe/London and `gb`, or Europe/Amsterdam and
     `us`).
   - **Services (option B only)**: turn **SSH on** and choose "Use password authentication".
5. Click **Save**, then **Yes** to start writing. This takes 5 to 15 minutes.
6. When Imager says it's finished, take the card out of your laptop.

## Step 2 — Connect the Pi

1. Insert the microSD card into the Pi (on the underside, contacts facing the board).
2. Connect the **network cable** between the Pi and your **router** (the internet box at home).
3. Option A only: connect the **screen** (Pi 3B+: the HDMI port; Pi 4/5: the micro-HDMI port closest to the power
   connector), and the **keyboard** and **mouse**.
4. Connect the power supply **last**. The Pi has no on/off button: it starts right away.

The first boot takes a few minutes (up to about 5 minutes on a Pi 3B+). With option A you'll eventually see a desktop
(or a login screen: log in with the username and password from step 1).

## Step 3 — Open a terminal

A **terminal** is a window where you type commands. You only need it for one line.

### Option A (screen on the Pi)

Click the **Raspberry menu** in the top left → **Accessories** → **Terminal**. A black window opens.

### Option B (from your laptop)

Wait about 3 minutes after switching on the Pi. Then open a terminal on your laptop:

- **Windows**: click Start, type `Terminal` (or `PowerShell`) and open it.
- **Mac**: press Cmd + space bar, type `Terminal` and press Enter.

Type this (replace `flipper` with your username from step 1) and press Enter:

```
ssh flipper@pinball-tournament.local
```

- The first time it asks whether you want to continue: type `yes` and press Enter.
- Type your password and press Enter. **Nothing appears while you type**: that's normal.
- It worked if you see something like `flipper@pinball-tournament:~ $`.

Doesn't work ("could not resolve hostname")? Wait a little longer and try again. Still not working: check in your
router's app or web page which IP address the device "pinball-tournament" has (e.g. `192.168.1.23`) and use
`ssh flipper@192.168.1.23`.

## Step 4 — Install

Copy this line (with the copy button, or select it and copy):

```
curl -fsSL https://voetzool.github.io/flipper-tournement/pi/install.sh | sudo bash
```

Paste it into the terminal and press **Enter**:

- **Option A**: right-click in the terminal window → **Paste** (or Ctrl + Shift + V).
- **Option B**: right-click in the terminal window (Windows) or Cmd + V (Mac).

Asked for a password? Type the Pi's password from step 1 (again, nothing appears while you type).

Everything is now installed. This takes **2 to 10 minutes** (up to about 15 minutes on a Pi 3B+); lots of text
scrolls by. It's done when you see **"Klaar!"** (Dutch for "Done!"), followed by the name and password of the Wi-Fi
network.

Prefer your own name and password for the Wi-Fi network? Use this line instead of the one above (the password must
be at least 8 characters):

```
curl -fsSL https://voetzool.github.io/flipper-tournement/pi/install.sh | sudo PINBALL_SSID=PinballNight PINBALL_WIFI_PASSWORD=mysecret123 bash
```

## Step 5 — Restart

Type this and press Enter:

```
sudo reboot
```

The Pi restarts (about 1 minute). With option B the connection to your laptop drops: that's normal.

## Step 6 — Use it

1. Take your phone, iPad or laptop and go to the **Wi-Fi settings**.
2. Choose the network **Pinball-Tournament**. The password is **flipper123** (or your own password from step 4).
3. Getting a **"No internet connection"** message? That's correct: the Pi doesn't need internet. Choose
   **"Stay connected"** / **"Use without internet"**.
4. Open the browser (Safari, Chrome…) and go to **http://pinball-tournament.local**.
   Doesn't work? Use **http://10.42.0.1**.
5. The app opens. Add players, machines and a tournament, just like in the phone app. You can switch the app to
   English under **Settings** → **Taal / Language**.

Handy:

- **Scoreboard on a laptop or TV**: open the tournament on the laptop, click the scoreboard icon (top right) and make
  the window full screen. Results entered on the iPad or phone appear automatically.
- **Find it again quickly**: make a bookmark, or on iPhone/iPad in Safari tap the share button → **Add to Home
  Screen**.

## Bringing data over from the phone app

Already have tournaments, players and machines in the phone app? You can transfer them:

1. Open the **phone app** (voetzool.github.io/flipper-tournement) → **Settings** → **Make backup**. Save the file on
   your phone.
2. Connect the same phone to the Pi's Wi-Fi network and open **http://pinball-tournament.local**.
3. Go to **Settings** → **Restore backup** and choose the file.

Note: this replaces everything that was already on the Pi.

## Everyday use

- **Switching on**: plug it in. After about a minute the Wi-Fi network is there and the app works.
- **Switching off**: preferably properly. Option A: Raspberry menu → Shutdown. Or in a terminal: `sudo shutdown now`.
  Wait until the green light stops blinking and then pull the plug. (Just pulling the plug usually works, but shutting
  down properly is safer for the SD card.)
- **Copies**: the Pi itself keeps a copy of the data every day (the last 14 days). To be safe, also make a backup now
  and then via Settings → **Make backup**.

## Updating to a new version

1. Reconnect the network cable to the Pi and your router (the Pi needs internet for this).
2. Open a terminal (step 3) and type:

```
sudo pinball-tournament update
```

Your data is kept.

## Changing the Wi-Fi password

Open a terminal on the Pi (step 3) and type (with your own new password of at least 8 characters):

```
sudo pinball-tournament wifi mynewpassword
```

After that, all devices need to reconnect with the new password.

Note for option B: if your laptop is only connected to the Pi through the Pi's Wi-Fi network, you can log in with
`ssh flipper@10.42.0.1` (same username and password as in step 1).

## Troubleshooting

| Problem | What you can do |
|---|---|
| I don't see the Wi-Fi network **Pinball-Tournament** | Wait 2 minutes after switching on. Still not there? Unplug and plug back in. If that doesn't help, open a terminal and type `sudo nmcli con up pinball-ap`. |
| **pinball-tournament.local** doesn't open | Check that you're connected to the Pi's Wi-Fi network. Try **http://10.42.0.1**. Type the address with **http://** in front (not https). |
| The app says **"No connection to the server"** | Is the Pi on? Is your device still on the Pi's Wi-Fi network? The app reconnects automatically; entered results are not lost. |
| **"could not resolve hostname"** with ssh (option B) | Wait a few more minutes, or use the IP address from your router (see step 3). |
| Installation stops with an error | Check that the network cable is connected and the Pi has internet, then paste the line from step 4 again. |
| I forgot the Pi's password | First make a backup via the app (Settings → Make backup). Then prepare the SD card again (step 1) and reinstall; afterwards restore the backup. |
| Something else isn't working | Open a terminal and type `sudo pinball-tournament logs`. Take a photo of the text and send it to the app's maker. `sudo pinball-tournament status` shows whether the server is running. |

## Command overview

| Command | What it does |
|---|---|
| `sudo pinball-tournament update` | Install the latest version (with internet via the network cable) |
| `sudo pinball-tournament wifi <password>` | Change the Wi-Fi password |
| `sudo pinball-tournament status` | Show whether the server is running |
| `sudo pinball-tournament logs` | Latest messages from the server |
| `sudo pinball-tournament restart` | Restart the server |
| `sudo reboot` | Restart the Pi |
| `sudo shutdown now` | Shut down the Pi properly |
