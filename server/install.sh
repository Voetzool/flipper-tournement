#!/usr/bin/env bash
# Pinball Tournament — installatie op een Raspberry Pi (Raspberry Pi OS Bookworm) of een andere Debian/Ubuntu-pc.
#
#   curl -fsSL https://voetzool.github.io/flipper-tournement/pi/install.sh | sudo bash
#
# Opties (na `sudo bash -s --`):
#   --no-wifi     geen eigen wifi-netwerk maken (bijv. op een gewone pc)
#   --update      alleen de app bijwerken (gegevens, hostname en wifi blijven zoals ze zijn)
#   --dry-run     alleen laten zien wat er zou gebeuren
#
# Instellingen via omgevingsvariabelen: PINBALL_SSID, PINBALL_WIFI_PASSWORD, PINBALL_COUNTRY, PINBALL_URL.
set -euo pipefail

BASE_URL="${PINBALL_URL:-https://voetzool.github.io/flipper-tournement/pi}"
APP_DIR=/opt/pinball-tournament
DATA_DIR=/var/lib/pinball-tournament
HOST=pinball-tournament
SERVICE=pinball-tournament
AP_CON=pinball-ap
AP_IP=10.42.0.1
SSID="${PINBALL_SSID:-Pinball-Tournament}"
WIFI_PASS="${PINBALL_WIFI_PASSWORD:-flipper123}"
COUNTRY="${PINBALL_COUNTRY:-NL}"

WIFI=1
UPDATE=0
DRY=0
for arg in "$@"; do
  case "$arg" in
    --no-wifi) WIFI=0 ;;
    --update) UPDATE=1 ;;
    --dry-run) DRY=1 ;;
    *) echo "Onbekende optie: $arg" >&2; exit 1 ;;
  esac
done

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
run() {
  if [ "$DRY" = 1 ]; then echo "+ $*"; else "$@"; fi
}
write() { # write <bestand>  (inhoud via stdin)
  if [ "$DRY" = 1 ]; then echo "+ schrijf $1:"; sed 's/^/    /'; else cat > "$1"; fi
}

if [ "$DRY" = 0 ] && [ "$(id -u)" != 0 ]; then
  echo "Start dit script met sudo, bijvoorbeeld: curl -fsSL $BASE_URL/install.sh | sudo bash" >&2
  exit 1
fi
if [ ${#WIFI_PASS} -lt 8 ]; then
  echo "Het wifi-wachtwoord moet minstens 8 tekens hebben." >&2
  exit 1
fi

# ---------- 1. Benodigde programma's ----------
say "Programma's installeren (Node.js, mDNS)"
run apt-get update -qq
run apt-get install -y -qq nodejs avahi-daemon curl ca-certificates tar
if [ "$DRY" = 0 ]; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "Node.js $NODE_MAJOR is te oud (minimaal 18 nodig). Gebruik Raspberry Pi OS Bookworm of nieuwer." >&2
    exit 1
  fi
fi

# ---------- 2. De app downloaden ----------
say "Nieuwste versie downloaden"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
run curl -fsSL "$BASE_URL/pinball-tournament.tar.gz" -o "$TMP/app.tar.gz"
run mkdir -p "$TMP/app"
run tar -xzf "$TMP/app.tar.gz" -C "$TMP/app"
run rm -rf "$APP_DIR.old"
if [ -d "$APP_DIR" ]; then run mv "$APP_DIR" "$APP_DIR.old"; fi
run mv "$TMP/app" "$APP_DIR"
run curl -fsSL "$BASE_URL/install.sh" -o "$APP_DIR/install.sh"
run chmod 755 "$APP_DIR" "$APP_DIR/install.sh"

# ---------- 3. Gebruiker, gegevensmap en service ----------
say "Service instellen (start automatisch, poort 80)"
if ! id pinball >/dev/null 2>&1; then run useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin pinball; fi
run mkdir -p "$DATA_DIR"
run chown -R pinball:pinball "$DATA_DIR"
write /etc/systemd/system/$SERVICE.service <<EOF
[Unit]
Description=Pinball Tournament
After=network.target

[Service]
User=pinball
Environment=PORT=80
Environment=DATA_DIR=$DATA_DIR
ExecStart=/usr/bin/node $APP_DIR/server.mjs
Restart=always
RestartSec=2
AmbientCapabilities=CAP_NET_BIND_SERVICE
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

# Hulpcommando: sudo pinball-tournament update | wifi <wachtwoord> | status | logs
write /usr/local/bin/pinball-tournament <<EOF
#!/usr/bin/env bash
set -e
case "\${1:-}" in
  update) curl -fsSL "$BASE_URL/install.sh" | bash -s -- --update ;;
  wifi)
    [ \${#2} -ge 8 ] || { echo "Gebruik: sudo pinball-tournament wifi <wachtwoord van minstens 8 tekens>"; exit 1; }
    nmcli con modify $AP_CON wifi-sec.psk "\$2" && nmcli con up $AP_CON && echo "Wifi-wachtwoord gewijzigd." ;;
  status) systemctl status $SERVICE --no-pager ;;
  logs) journalctl -u $SERVICE -n 100 --no-pager ;;
  restart) systemctl restart $SERVICE ;;
  *) echo "Gebruik: sudo pinball-tournament update | wifi <wachtwoord> | status | logs | restart"
     echo "Gegevens en dagelijkse kopieën: $DATA_DIR" ;;
esac
EOF
run chmod 755 /usr/local/bin/pinball-tournament
run systemctl daemon-reload
run systemctl enable $SERVICE
run systemctl restart $SERVICE

if [ "$UPDATE" = 1 ]; then
  say "Bijgewerkt! De gegevens zijn bewaard gebleven."
  exit 0
fi

# ---------- 4. Naam op het netwerk: pinball-tournament.local ----------
say "Netwerknaam instellen: $HOST.local"
run hostnamectl set-hostname "$HOST"
if grep -q '^127.0.1.1' /etc/hosts; then
  run sed -i "s/^127.0.1.1.*/127.0.1.1\t$HOST/" /etc/hosts
else
  run sh -c "printf '127.0.1.1\t%s\n' '$HOST' >> /etc/hosts"
fi
run systemctl enable --now avahi-daemon
run systemctl restart avahi-daemon

# ---------- 5. Eigen wifi-netwerk (AP-modus) ----------
if [ "$WIFI" = 1 ]; then
  if ! command -v nmcli >/dev/null 2>&1; then
    echo "NetworkManager (nmcli) niet gevonden: geen eigen wifi-netwerk gemaakt. Gebruik Raspberry Pi OS Bookworm."
    WIFI=0
  else
    say "Wifi-netwerk '$SSID' maken"
    if command -v raspi-config >/dev/null 2>&1; then run raspi-config nonint do_wifi_country "$COUNTRY"; fi
    run rfkill unblock wifi || true
    # Zo vinden ook apparaten zonder mDNS (sommige Android-telefoons) de server.
    run mkdir -p /etc/NetworkManager/dnsmasq-shared.d
    write /etc/NetworkManager/dnsmasq-shared.d/pinball-tournament.conf <<EOF
address=/$HOST.local/$AP_IP
address=/$HOST/$AP_IP
EOF
    run nmcli con delete "$AP_CON" >/dev/null 2>&1 || true
    run nmcli con add type wifi ifname wlan0 con-name "$AP_CON" autoconnect yes ssid "$SSID" \
      802-11-wireless.mode ap 802-11-wireless.band bg \
      ipv4.method shared ipv4.addresses "$AP_IP/24" ipv6.method disabled \
      wifi-sec.key-mgmt wpa-psk wifi-sec.proto rsn wifi-sec.pairwise ccmp wifi-sec.group ccmp wifi-sec.psk "$WIFI_PASS" \
      connection.autoconnect-priority 100
    # Loopt deze installatie zelf via wifi, dan zou het netwerk nu wegvallen: dan pas na een herstart aanzetten.
    if [ "$DRY" = 0 ] && ip route show default 2>/dev/null | grep -q 'dev wlan0'; then
      echo "Je bent nu via wifi verbonden; het wifi-netwerk van de Pi start na een herstart (sudo reboot)."
      echo "Tip: sluit de Pi met een netwerkkabel aan als je daarna nog internet op de Pi wilt."
    else
      run nmcli con up "$AP_CON" || echo "Wifi-netwerk start na een herstart (sudo reboot)."
    fi
  fi
fi

# ---------- Klaar ----------
say "Klaar!"
if [ "$WIFI" = 1 ]; then
  cat <<EOF
  1. Verbind je telefoon/iPad/laptop met het wifi-netwerk:
       naam:       $SSID
       wachtwoord: $WIFI_PASS
  2. Open in de browser:  http://$HOST.local   (of http://$AP_IP)

  Wifi-wachtwoord wijzigen:  sudo pinball-tournament wifi <nieuw-wachtwoord>
EOF
else
  echo "  Open in de browser (op hetzelfde netwerk):  http://$HOST.local"
fi
cat <<EOF
  Bijwerken naar de nieuwste versie:  sudo pinball-tournament update
  Gegevens (met dagelijkse kopieën):  $DATA_DIR
EOF
