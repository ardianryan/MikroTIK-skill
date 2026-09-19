# RouterOS v7 Packet Flow & Connection Tracking Specification

An enterprise network engineer certified in MTCTCE (MikroTik Certified Traffic Control Engineer) must understand the RouterOS v7 Packet Flow inside out. Every routing decision, firewall filter, NAT translation, and QoS queue depends strictly on this traversal order.

---

## 1. The Master Traversal Pipeline

When an IPv4/IPv6 packet enters a RouterOS v7 interface, it traverses the Linux kernel network stack and RouterOS subsystem in this exact order:

```
[ Ingress Interface ]
        │
        ▼
[ L2 Bridging Decision ] ──(If bridging only & no bridge firewall)──► [ Egress Port ]
        │
        ▼ (If routed or use-ip-firewall=yes)
[ 1. RAW (Prerouting) ] ──────► (action=drop or action=notrack)
        │
        ▼
[ 2. Connection Tracking ] ───► (Assigns: new, established, related, invalid, untracked)
        │
        ▼
[ 3. MANGLE (Prerouting) ] ───► (Tier 0 Bypass, Tier 1 Overrides, Tier 2 PCC Mark)
        │
        ▼
[ 4. DST-NAT (Prerouting) ] ──► (Port forwarding, redirect to web-proxy or DNS)
        │
        ▼
[ 5. Routing Decision (FIB) ]
        ├─────────────────────────────┬─────────────────────────────┐
        ▼                             ▼                             ▼
  [ Local Delivery ]          [ Forwarding Path ]           [ FastTrack Path ]
        │                             │                             │
[ 6. MANGLE (Input) ]         [ 8. MANGLE (Forward) ]       (Bypasses Mangle
        │                             │                      and Queue Trees!)
[ 7. FILTER (Input) ]         [ 9. FILTER (Forward) ]               │
        │                             │                             │
 [ Local Process / ROS ]              ▼                             ▼
        │                    [ 10. Post-Routing Decision ] ◄────────┘
        ▼                             │
[ Local Origination ]                 ▼
        │                    [ 11. MANGLE (Postrouting) ]
[ MANGLE (Output) ]                   │
        │                    [ 12. SRC-NAT (Postrouting) ] ──► (Masquerade / SNAT)
[ FILTER (Output) ]                   │
        │                    [ 13. Queue Tree / Simple Queue ] ──► (CAKE / FQ-CoDel)
        └────────────────────────────►│
                                      ▼
                              [ Egress Interface ]
```

---

## 2. Connection Tracking States & Invariants

Connection Tracking (Conntrack) is the stateful heart of RouterOS. Every packet is classified into one of five states:

| Conntrack State | Technical Definition | Engineering Action |
|---|---|---|
| `established` | Packet belongs to an already active bi-directional stream registered in Conntrack. | Accept immediately in Filter Input & Forward chains to minimize CPU processing. |
| `related` | Packet begins a new connection that is semantically tied to an existing one (e.g., FTP data, ICMP errors, SIP RTP). | Accept with `established`. Requires appropriate `/ip firewall service-port` helpers. |
| `new` | The first packet initiating a connection (e.g., TCP SYN, first UDP packet). | Must pass full firewall inspection, Mangle classification, and NAT processing. |
| `invalid` | Packet does not match any recognized session, has corrupted TCP flags, or out-of-window sequence numbers. | **Always drop early** in Filter Input and Forward chains. |
| `untracked` | Packet was exempted from Conntrack in the `raw` prerouting chain (`action=notrack`). | Bypasses NAT and stateful firewall; dramatically reduces CPU load during DDoS attacks or wire-speed transit. |

---

## 3. FastTrack: Acceleration vs Traffic Control Trade-off

FastTrack bypasses most of the Linux networking stack for established TCP/UDP streams:

### What FastTrack Bypasses:
1. Mangle Prerouting, Forward, and Postrouting.
2. Filter Forward (after initial connection establishment).
3. Queue Trees (`/queue tree`) and Simple Queues (`/queue simple`).
4. IPsec policy checks (if not encapsulated).

### Certified Engineer FastTrack Rule:
If deploying **Policy-Based Routing (PCC)** or **CAKE QoS / Bandwidth Management**, you MUST either:
- **Exempt marked traffic:**
  ```routeros
  /ip firewall filter set [find action=fasttrack-connection] connection-mark=no-mark
  ```
- **Or disable FastTrack completely** if universal traffic shaping or full-packet inspection is required:
  ```routeros
  /ip firewall filter disable [find action=fasttrack-connection]
  ```

---

## 4. Prerouting vs Forward vs Postrouting Mangle Rules

| Chain | Target Scope | Permitted Actions | Certified Usage |
|---|---|---|---|
| `prerouting` | Ingress packets before routing decision | `mark-connection`, `mark-routing`, `accept`, `change-mss` | PCC load balancing, destination NAT bypass, client policy routing. |
| `forward` | Transit packets passing through the router | `mark-packet`, `change-mss` | QoS packet marking for Queue Tree, MSS clamping for PPPoE/WireGuard. |
| `postrouting` | Packets after routing decision, before egress | `mark-packet`, `snat`, `masquerade` | Outgoing QoS queue classification, source NAT. |
| `input` | Packets destined for the router's own IP | `mark-connection`, `mark-packet` | Local management bandwidth limiting, VIP traffic accounting. |
| `output` | Packets generated locally by the router | `mark-routing`, `mark-connection` | Routing router-originated traffic (e.g., DNS queries, NTP) via a specific WAN. |
