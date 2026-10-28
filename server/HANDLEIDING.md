# Pinball Tournament op een Raspberry Pi installeren

Deze handleiding is voor iemand die **nog nooit** iets met een Raspberry Pi heeft gedaan. Hij werkt voor een
**Raspberry Pi 3B+, 4 of 5**. Je hebt ongeveer
**30 minuten** nodig. Je hoeft niets te programmeren: je plakt één regel tekst en de rest gaat vanzelf.

Na afloop maakt de Pi een eigen wifi-netwerk. Telefoons, iPads en laptops die daarmee verbonden zijn openen de app
op **http://pinball-tournament.local**. Alle gegevens staan op de Pi, en alle schermen werken vanzelf bij.

> Tip: open deze pagina op je telefoon, dan kun je hem lezen terwijl je bezig bent.

## Wat heb je nodig

| Wat | Toelichting |
|---|---|
| **Raspberry Pi 3B+, 4 of 5** | Elke geheugengrootte is goed; de 1 GB van de Pi 3B+ is genoeg. |
| **Officiële voeding** | Pi 3B+: de micro-USB-voeding van 5 V / 2,5 A. Pi 4: de 15 W USB-C-voeding. Pi 5: de 27 W USB-C-voeding. Een telefoonlader werkt vaak níet goed. |
| **microSD-kaart** | Minimaal 16 GB, liefst met "A1" of "A2" erop (sneller). |
| **SD-kaartlezer** | Om de kaart vanaf je laptop klaar te maken (zit soms in de laptop). |
| **Netwerkkabel** | Om de Pi tijdens het installeren met internet (je router) te verbinden. |
| **Laptop of pc** | Windows of Mac. |
| Behuizing (optioneel) | Beschermt de Pi. Bij een Pi 5 is een behuizing met ventilator handig. |

Er zijn **twee manieren** om de Pi de eerste keer te bedienen. Kies er één:

- **Manier A — met een scherm**: je sluit een scherm (of tv), toetsenbord en muis aan op de Pi. Hiervoor heb je
  ook een HDMI-kabel nodig, plus een USB-toetsenbord en -muis. Let op welke kabel:
  - **Pi 3B+**: een **gewone HDMI-kabel** (zoals bij een tv).
  - **Pi 4 en 5**: een **micro-HDMI-kabel** (de kleine aansluiting).
- **Manier B — vanaf je laptop**: de Pi heeft geen scherm nodig; je bedient hem op afstand vanaf je laptop. Je
  laptop moet dan op hetzelfde (thuis)netwerk zitten als de Pi.

Weet je het niet zeker? Kies **manier A**: dan zie je precies wat er gebeurt.

## Stap 1 — De SD-kaart klaarmaken (op je laptop)

De SD-kaart is de "harde schijf" van de Pi. Daar zetten we eerst het besturingssysteem op (Raspberry Pi OS).

1. Download en installeer **Raspberry Pi Imager** van **https://www.raspberrypi.com/software/**.
2. Stop de microSD-kaart in je laptop (eventueel via de kaartlezer).
3. Start Raspberry Pi Imager en kies:
   - **Apparaat / Device**: Raspberry Pi 3, Raspberry Pi 4 of Raspberry Pi 5 (welke je hebt; een 3B+ valt onder
     Raspberry Pi 3).
   - **Besturingssysteem / Operating System**:
     - manier A: **Raspberry Pi OS (64-bit)**;
     - manier B: kies **Raspberry Pi OS (other)** en dan **Raspberry Pi OS Lite (64-bit)**.
   - **Opslag / Storage**: je SD-kaart. Let op: alles wat er al op de kaart staat wordt gewist.
4. Klik op **Volgende**. Imager vraagt of je instellingen wilt aanpassen: kies **Instellingen bewerken** (of
   "Edit settings" / "Customisation") en vul in:
   - **Hostnaam / Hostname**: `pinball-tournament`
   - **Gebruikersnaam en wachtwoord**: verzin ze zelf, bijvoorbeeld gebruikersnaam `flipper`. **Schrijf ze op!**
     Je hebt ze straks nodig.
   - **Wifi**: **niet** invullen (laat leeg). De Pi gaat straks zelf een wifi-netwerk maken.
   - **Tijdzone**: Europe/Amsterdam. **Toetsenbordindeling**: `us` (de meeste Nederlandse toetsenborden).
   - **Diensten / Services (alleen manier B)**: zet **SSH aan** en kies "Gebruik wachtwoord-authenticatie".
5. Klik op **Opslaan**, dan **Ja** om te beginnen met schrijven. Dit duurt 5 tot 15 minuten.
6. Als Imager "klaar" meldt, haal je de kaart uit je laptop.

## Stap 2 — De Pi aansluiten

1. Stop de microSD-kaart in de Pi (aan de onderkant, de contactjes naar de printplaat toe).
2. Sluit de **netwerkkabel** aan tussen de Pi en je **router** (het internetkastje thuis).
3. Alleen manier A: sluit het **scherm** aan (Pi 3B+: de HDMI-poort; Pi 4/5: de micro-HDMI-poort het dichtst bij de
   voedingsaansluiting), en het
   **toetsenbord** en de **muis**.
4. Sluit **als laatste** de voeding aan. De Pi heeft geen aan/uit-knop: hij start meteen.

De eerste keer opstarten duurt een paar minuten (bij een Pi 3B+ tot ongeveer 5 minuten). Bij manier A zie je uiteindelijk een bureaublad (of een
inlogscherm: log dan in met de gebruikersnaam en het wachtwoord uit stap 1).

## Stap 3 — Een terminal openen

Een **terminal** is een venster waarin je opdrachten typt. Je hebt er één regel in nodig.

### Manier A (scherm op de Pi)

Klik linksboven op het **Raspberry-menu** → **Accessoires** (Accessories) → **Terminal**. Er opent een zwart venster.

### Manier B (vanaf je laptop)

Wacht na het aanzetten van de Pi ongeveer 3 minuten. Open dan op je laptop een terminal:

- **Windows**: klik op Start, typ `Terminal` (of `PowerShell`) en open het.
- **Mac**: druk op Cmd + spatiebalk, typ `Terminal` en druk op Enter.

Typ dit (vervang `flipper` door jouw gebruikersnaam uit stap 1) en druk op Enter:

```
ssh flipper@pinball-tournament.local
```

- De eerste keer vraagt hij of je wilt doorgaan: typ `yes` en druk op Enter.
- Typ je wachtwoord en druk op Enter. **Je ziet niets terwijl je typt**: dat is normaal.
- Gelukt als er iets staat als `flipper@pinball-tournament:~ $`.

Lukt het niet ("could not resolve hostname")? Wacht nog even en probeer opnieuw. Werkt het dan nog niet: kijk in
de app of website van je router welk IP-adres het apparaat "pinball-tournament" heeft (bijv. `192.168.1.23`) en
gebruik `ssh flipper@192.168.1.23`.

## Stap 4 — Installeren

Kopieer deze regel (met de kopieerknop of selecteren + kopiëren):

```
curl -fsSL https://voetzool.github.io/flipper-tournement/pi/install.sh | sudo bash
```

Plak hem in de terminal en druk op **Enter**:

- **Manier A**: rechtsklik in het terminalvenster → **Plakken** (of Ctrl + Shift + V).
- **Manier B**: rechtsklik in het terminalvenster (Windows) of Cmd + V (Mac).

Vraagt hij om een wachtwoord? Typ het wachtwoord van de Pi uit stap 1 (je ziet weer niets terwijl je typt).

Nu wordt alles geïnstalleerd. Dat duurt **2 tot 10 minuten** (bij een Pi 3B+ tot ongeveer 15 minuten); er komt veel tekst voorbij. Het is klaar als je
**"Klaar!"** ziet, met daaronder de naam en het wachtwoord van het wifi-netwerk.

Liever een eigen naam en wachtwoord voor het wifi-netwerk? Gebruik dan deze regel in plaats van de regel hierboven
(het wachtwoord moet minstens 8 tekens hebben):

```
curl -fsSL https://voetzool.github.io/flipper-tournement/pi/install.sh | sudo PINBALL_SSID=Flipperavond PINBALL_WIFI_PASSWORD=mijngeheim123 bash
```

## Stap 5 — Herstarten

Typ dit en druk op Enter:

```
sudo reboot
```

De Pi start opnieuw op (ongeveer 1 minuut). Bij manier B verdwijnt de verbinding met je laptop: dat is normaal.

## Stap 6 — Gebruiken

1. Pak je telefoon, iPad of laptop en ga naar de **wifi-instellingen**.
2. Kies het netwerk **Pinball-Tournament**. Het wachtwoord is **flipper123** (of je eigen wachtwoord uit stap 4).
3. Krijg je de melding **"Geen internetverbinding"**? Dat klopt: de Pi heeft geen internet nodig. Kies
   **"Blijf verbonden"** / **"Gebruik zonder internet"**.
4. Open de browser (Safari, Chrome…) en ga naar **http://pinball-tournament.local**.
   Werkt dat niet? Gebruik **http://10.42.0.1**.
5. De app opent. Maak spelers, machines en een toernooi aan, net als in de telefoon-app.

Handig:

- **Scorebord op een laptop of tv**: open op de laptop het toernooi, klik op het scorebord-icoon (rechtsboven) en
  zet het venster op volledig scherm. Uitslagen die je op de iPad of telefoon invoert verschijnen er vanzelf.
- **Snel terugvinden**: maak een bladwijzer, of kies op iPhone/iPad in Safari de deelknop → **Zet op beginscherm**.

## Gegevens uit de telefoon-app meenemen

Heb je al toernooien, spelers en machines in de telefoon-app? Die kun je overzetten:

1. Open de **telefoon-app** (voetzool.github.io/flipper-tournement) → **Instellingen** → **Back-up maken**.
   Bewaar het bestand op je telefoon.
2. Verbind dezelfde telefoon met het wifi-netwerk van de Pi en open **http://pinball-tournament.local**.
3. Ga naar **Instellingen** → **Back-up terugzetten** en kies het bestand.

Let op: dit vervangt alles wat al op de Pi stond.

## Dagelijks gebruik

- **Aanzetten**: stekker erin. Na ongeveer een minuut is het wifi-netwerk er en werkt de app.
- **Uitzetten**: liefst netjes. Manier A: Raspberry-menu → Afsluiten. Of in een terminal: `sudo shutdown now`.
  Wacht tot het groene lampje niet meer knippert en haal dan de stekker eruit. (Gewoon de stekker eruit trekken
  gaat meestal goed, maar netjes afsluiten is veiliger voor de SD-kaart.)
- **Kopieën**: de Pi bewaart zelf elke dag een kopie van de gegevens (de laatste 14 dagen). Maak voor de zekerheid
  af en toe ook een back-up via Instellingen → **Back-up maken**.

## Bijwerken naar een nieuwe versie

1. Sluit de netwerkkabel weer aan op de Pi en je router (de Pi heeft hiervoor internet nodig).
2. Open een terminal (stap 3) en typ:

```
sudo pinball-tournament update
```

Je gegevens blijven gewoon bewaard.

## Wifi-wachtwoord wijzigen

Open een terminal op de Pi (stap 3) en typ (met je eigen nieuwe wachtwoord van minstens 8 tekens):

```
sudo pinball-tournament wifi mijnnieuwwachtwoord
```

Daarna moeten alle apparaten opnieuw verbinden met het nieuwe wachtwoord.

Let op bij manier B: zit je laptop alleen via het wifi-netwerk van de Pi aan de Pi, dan kun je inloggen met
`ssh flipper@10.42.0.1` (zelfde gebruikersnaam en wachtwoord als in stap 1).

## Problemen oplossen

| Probleem | Wat kun je doen |
|---|---|
| Ik zie het wifi-netwerk **Pinball-Tournament** niet | Wacht 2 minuten na het aanzetten. Nog steeds niet? Haal de stekker eruit en weer erin. Helpt dat niet, open een terminal en typ `sudo nmcli con up pinball-ap`. |
| **pinball-tournament.local** opent niet | Controleer of je met het wifi-netwerk van de Pi verbonden bent. Probeer **http://10.42.0.1**. Typ het adres met **http://** ervoor (niet https). |
| De app meldt **"Geen verbinding met de server"** | Staat de Pi aan? Zit je apparaat nog op het wifi-netwerk van de Pi? De app maakt vanzelf weer verbinding; ingevoerde uitslagen gaan niet verloren. |
| **"could not resolve hostname"** bij ssh (manier B) | Wacht nog een paar minuten, of gebruik het IP-adres uit je router (zie stap 3). |
| Het installeren stopt met een foutmelding | Controleer of de netwerkkabel goed zit en de Pi internet heeft, en plak de regel uit stap 4 opnieuw. |
| Ik ben het wachtwoord van de Pi vergeten | Maak eerst een back-up via de app (Instellingen → Back-up maken). Maak daarna de SD-kaart opnieuw (stap 1) en installeer opnieuw; zet daarna de back-up terug. |
| Iets anders werkt niet | Open een terminal en typ `sudo pinball-tournament logs`. Maak een foto van de tekst en stuur die naar de maker van de app. Met `sudo pinball-tournament status` zie je of de server draait. |

## Overzicht van de commando's

| Commando | Wat het doet |
|---|---|
| `sudo pinball-tournament update` | Nieuwste versie installeren (met internet via de netwerkkabel) |
| `sudo pinball-tournament wifi <wachtwoord>` | Wifi-wachtwoord wijzigen |
| `sudo pinball-tournament status` | Laten zien of de server draait |
| `sudo pinball-tournament logs` | Laatste meldingen van de server |
| `sudo pinball-tournament restart` | De server opnieuw starten |
| `sudo reboot` | De Pi opnieuw opstarten |
| `sudo shutdown now` | De Pi netjes uitzetten |
