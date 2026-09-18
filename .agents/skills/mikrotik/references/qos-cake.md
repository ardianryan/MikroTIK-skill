# Modern QoS: CAKE & FQ-CoDel Anti-Bufferbloat in RouterOS v7

This runbook covers configuring modern Active Queue Management (AQM) algorithms—**CAKE** and **FQ-CoDel**—in RouterOS v7 to eliminate bufferbloat and maintain sub-15ms latency under 100% WAN saturation.

---

## 1. Why CAKE / FQ-CoDel Over Legacy Simple Queues

- **Legacy Simple Queues (FIFO / PCQ):** Suffer from bufferbloat because buffers fill up before packets drop, inducing 200ms+ latency spikes during heavy downloads.
- **CAKE (Common Applications Kept Enhanced):** Automatically separates flows, prioritizes TCP ACKs, handles round-trip time variations, and dynamically hashes packets to guarantee fair bandwidth distribution with deterministic low latency.

---

## 2. Queue Types Definition

Create the CAKE queue types for download and upload shaping:

```routeros
# Download Queue Type (handles incoming ingress traffic)
/queue type add name="cake-download" kind=cake cake-diffserv=diffserv4 cake-flowmode=triple-isolate cake-overhead-scheme=ethernet cake-rtt=100ms

# Upload Queue Type (handles outgoing egress traffic)
/queue type add name="cake-upload" kind=cake cake-diffserv=diffserv4 cake-ack-filter=filter cake-flowmode=triple-isolate cake-overhead-scheme=ethernet cake-rtt=100ms
```

---

## 3. Queue Tree Application (WAN Shaping)

Set the `max-limit` to approximately **90-95%** of your verified ISP bandwidth to ensure the router, rather than the ISP's modem buffer, controls the queue:

```routeros
# Suppose Primary ISP has 100M down / 50M up:
# Set 95M down / 47M up

# Ingress / Download Limiter (attached to LAN bridge or parent global)
/queue tree add name="WAN1_Download" parent=bridge queue=cake-download max-limit=95M comment="CAKE Bufferbloat Ingress"

# Egress / Upload Limiter (attached to outgoing WAN interface)
/queue tree add name="WAN1_Upload" parent=ether1-WAN1 queue=cake-upload max-limit=47M comment="CAKE Bufferbloat Egress"
```

---

## 4. DSCP Packet Marking for Interactive Traffic

Map real-time audio/video and interactive SSH traffic into higher priority DiffServ classes:

```routeros
# Mark DNS & ICMP (Ping)
/ip firewall mangle add chain=prerouting protocol=icmp action=set-priority new-priority=6 comment="Priority ICMP"
/ip firewall mangle add chain=prerouting protocol=udp dst-port=53 action=set-priority new-priority=6 comment="Priority DNS"

# Mark Voice / SIP / RTP (VoIP)
/ip firewall mangle add chain=prerouting protocol=udp port=5060,5061 action=set-priority new-priority=5 comment="Priority SIP"
/ip firewall mangle add chain=prerouting protocol=udp port=10000-20000 action=set-priority new-priority=5 comment="Priority RTP"
```
