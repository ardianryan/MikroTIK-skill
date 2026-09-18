# WireGuard Zero-Trust VPN Configuration in RouterOS v7

This runbook covers configuring high-performance, low-overhead WireGuard remote-access and site-to-site tunnels on MikroTik RouterOS v7.

---

## 1. WireGuard Server Interface Creation

RouterOS v7 includes native kernel WireGuard support:

```routeros
# 1. Create WireGuard Interface (Generates Public and Private Key)
/interface wireguard add name=wg0 listen-port=13231 comment="WireGuard VPN Server"

# 2. Assign IP Address to Interface
/ip address add address=10.10.10.1/24 interface=wg0 network=10.10.10.0

# 3. Retrieve Server Public Key
/interface wireguard print
# Note the 'public-key' attribute value
```

---

## 2. Firewall Filter Protection

Permit WireGuard handshake traffic into the router:

```routeros
# Allow inbound WireGuard UDP handshake port
/ip firewall filter add chain=input protocol=udp dst-port=13231 in-interface-list=WAN action=accept comment="Allow WireGuard Inbound"

# Allow WireGuard clients to reach LAN subnets
/ip firewall filter add chain=forward in-interface=wg0 out-interface-list=LAN action=accept comment="Allow WG to LAN"
```

---

## 3. Adding Client Peers (Road Warrior)

```routeros
# Add Remote Client Peer
/interface wireguard peers add interface=wg0 \
    public-key="CLIENT_PUBLIC_KEY_BASE64=" \
    allowed-address=10.10.10.2/32 \
    comment="Engineer Laptop"
```

---

## 4. Client WireGuard Configuration (`wg-client.conf`)

Provide this configuration file or QR code to the remote client:

```ini
[Interface]
PrivateKey = CLIENT_PRIVATE_KEY_BASE64=
Address = 10.10.10.2/24
DNS = 10.10.10.1

[Peer]
PublicKey = SERVER_PUBLIC_KEY_BASE64=
Endpoint = your-router-ddns-or-ip.net:13231
AllowedIPs = 10.10.10.0/24, 192.168.88.0/24
PersistentKeepalive = 25
```
