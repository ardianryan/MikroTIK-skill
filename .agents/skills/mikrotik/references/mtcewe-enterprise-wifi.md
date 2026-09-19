# MTCEWE & MTCWE: Enterprise Wireless, Wi-Fi 6 (802.11ax) & CAPsMAN v2

The MikroTik Certified Enterprise Wireless Engineer (MTCEWE) and Wireless Engineer (MTCWE) curricula cover modern 802.11ax (Wi-Fi 6) architectures, central CAPsMAN v2 controller deployment, 802.11r/k/v fast roaming, and dynamic VLAN assignment under RouterOS v7.

---

## 1. The Modern RouterOS v7 `wifi` Architecture

In RouterOS v7, the legacy `wireless` package (`/interface wireless`) is deprecated in favor of the modern `wifi-qcom` / `wifi` package (`/interface wifi`).

### Certified Engineer Architectural Differences:
- **Unified Menu:** Local interfaces and CAPsMAN clients share the exact same configuration syntax under `/interface wifi`.
- **WPA3 Standards:** Native support for WPA3-Personal (SAE) and WPA3-Enterprise (802.1X EAP-TLS).
- **Fast Roaming (802.11r / 802.11k / 802.11v):** Supported natively to eliminate voice/video call drops when roaming between APs.
- **Dynamic Forwarding:** Local forwarding (`client traffic bridged locally on AP switch chip`) vs Manager forwarding (`tunneled back to central controller`).

---

## 2. Centralized CAPsMAN v2 Controller Setup

Deploy a central controller on a core router (e.g. CCR2004 or RB5009) managing multiple ceiling APs (cAP ax / hAP ax3).

```routeros
# 1. Enable Central CAPsMAN v2 Controller
/interface wifi capsman
set enabled=yes ca-certificate=auto certificate=auto require-peer-certificate=no

# 2. Define Enterprise Security Profile (WPA2 + WPA3 + 802.11r Fast Roaming)
/interface wifi security
add name=SEC-CORP \
    authentication-types=wpa2-psk,wpa3-psk \
    passphrase="SuperEnterprisePassphrase123" \
    ft=yes ft-over-ds=yes ft-preserve-vlanid=yes \
    wps=disable

# 3. Define Master Channel Profiles (Wi-Fi 6 / 802.11ax 5GHz and 2.4GHz)
/interface wifi channel
add name=CH-5GHZ-AX band=5ghz-ax width=20/40/80mhz skip-dfs-channels=10min-cac
add name=CH-2GHZ-AX band=2ghz-ax width=20mhz

# 4. Define Master Wi-Fi Configuration Templates
/interface wifi configuration
add name=CFG-STAFF-5G mode=ap ssid="Enterprise-Staff" \
    security=SEC-CORP channel=CH-5GHZ-AX \
    datapath.bridge=bridge1 datapath.vlan-id=10

add name=CFG-STAFF-2G mode=ap ssid="Enterprise-Staff" \
    security=SEC-CORP channel=CH-2GHZ-AX \
    datapath.bridge=bridge1 datapath.vlan-id=10

# 5. Define Automated Provisioning Rules
/interface wifi provisioning
add radio-mac=00:00:00:00:00:00 master-configuration=CFG-STAFF-5G supported-bands=5ghz-ax action=create-dynamic-interfaces
add radio-mac=00:00:00:00:00:00 master-configuration=CFG-STAFF-2G supported-bands=2ghz-ax action=create-dynamic-interfaces
```

---

## 3. Remote Access Point (CAP) Client Configuration

On each remote cAP ax / hAP ax access point:

```routeros
# Point the Access Point to the Central Controller
/interface wifi cap
set enabled=yes discovery-interfaces=bridge1 \
    certificate=none lock-to-caps-man=yes
```

---

## 4. 802.11r/k/v Roaming Optimization (Fast BSS Transition)

To ensure VoIP calls (WhatsApp, Zoom, Teams) do not drop when walking between rooms:
1. **802.11r (Fast BSS Transition):** Pre-authenticates with neighbor APs before disconnecting from the current AP.
2. **802.11k (Radio Resource Measurement):** Sends a neighbor AP list to mobile devices, eliminating time spent scanning every channel.
3. **802.11v (BSS Transition Management):** Allows the network to request sticky devices to roam to an AP with stronger RSSI.

```routeros
# Enable Neighbor Report and BSS Transition
/interface wifi configuration set CFG-STAFF-5G \
    steering.neighbor-report=yes \
    steering.rrm=yes \
    security.ft=yes \
    security.ft-over-ds=yes
```

---

## 5. Dynamic VLAN Assignment over 802.1X (User Manager v7)

When clients connect using WPA2/WPA3-Enterprise 802.1X, User Manager can inject the VLAN tag dynamically based on the user's Active Directory / RADIUS group:

```routeros
/interface wifi datapath
add name=DP-DYNAMIC-VLAN client-isolation=yes vlan-id=auto

/interface wifi security
add name=SEC-EAP-8021X authentication-types=wpa2-eap,wpa3-eap \
    eap-methods=peap,eap-tls tls-certificate=auto

/interface wifi configuration
add name=CFG-ENTERPRISE-8021X ssid="Enterprise-Secure" \
    security=SEC-EAP-8021X datapath=DP-DYNAMIC-VLAN
```
