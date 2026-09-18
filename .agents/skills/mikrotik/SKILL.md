---
name: mikrotik
description: "Enterprise network automation, multi-WAN load balancing, security audits, and configuration runbooks for MikroTik RouterOS v7. Use when auditing RouterOS security, setting up dual-WAN failover/PCC, configuring WPA2/WPA3 Enterprise 802.1X RADIUS, deploying CAKE QoS, creating WireGuard tunnels, or running containers."
---

# MikroTik RouterOS v7 Automation & Enterprise Engineering Skill

Production-grade guidance, architecture standards, and operational runbooks for managing MikroTik RouterOS v7 devices.

## Core Directives

1. **Vendor-Neutral Terminology:** Never assume or hardcode commercial ISP names. Always use `ISP1`, `ISP2`, `WAN1`, `WAN2`, `Primary ISP`, or `Secondary ISP`.
2. **Deterministic Mangle Hierarchy:** Packets evaluate top-to-bottom. Always place:
   - **Tier 0 (Bypass):** `connection-nat-state=dstnat action=accept` (Hairpin NAT protect) and `LOCAL_BYPASS` address-list accept rules at index 0.
   - **Tier 1 (Dedicated Overrides):** Client-specific IP routing rules (`action=mark-routing passthrough=no`).
   - **Tier 2 (Load Balancing):** PCC connection-mark and routing-mark rules.
3. **RouterOS v7 FIB Requirement:** Every custom routing table used in Mangle (`new-routing-mark`) **must** be explicitly defined in `/routing table` with `fib=yes`. In RouterOS v7, referencing an undeclared table silently falls back to the `main` routing table.
4. **Safe-Mode Watchdog:** Before executing disruptive mutations (routing table or firewall filter modifications), always arm a 30-second watchdog scheduler or use `--dry-run` to preview the change diff.

---

## 1. Multi-WAN PCC Load Balancing & Failover in RouterOS v7

### 1.1. Routing Tables Definition
RouterOS v7 requires routing tables to be registered before use:
```routeros
/routing table add name="to_ISP1" fib
/routing table add name="to_ISP2" fib
```

### 1.2. Recursive Route Failover (Scope 10 / Target-Scope 11)
To ensure failover triggers even if the physical link stays up while the upstream ISP gateway loses Internet access, use recursive routing with public DNS targets:
```routeros
# Virtual routes to public DNS canaries
/ip route add dst-address=1.1.1.1/32 gateway=192.168.1.1 scope=10 comment="Canary Primary ISP"
/ip route add dst-address=8.8.8.8/32 gateway=192.168.2.1 scope=10 comment="Canary Secondary ISP"

# Default routes tracking canaries via check-gateway
/ip route add distance=1 gateway=1.1.1.1 check-gateway=ping target-scope=11 comment="Default Primary ISP"
/ip route add distance=2 gateway=8.8.8.8 check-gateway=ping target-scope=11 comment="Default Secondary ISP"

# Policy routing tables
/ip route add distance=1 gateway=1.1.1.1 routing-table=to_ISP1 check-gateway=ping target-scope=11
/ip route add distance=2 gateway=8.8.8.8 routing-table=to_ISP1 target-scope=11

/ip route add distance=1 gateway=8.8.8.8 routing-table=to_ISP2 check-gateway=ping target-scope=11
/ip route add distance=2 gateway=1.1.1.1 routing-table=to_ISP2 target-scope=11
```

### 1.3. Mangle Rules Order
```routeros
# 1. Hairpin NAT & Local Bypass (Top Index 0..1)
/ip firewall mangle add chain=prerouting action=accept connection-nat-state=dstnat comment="Hairpin NAT Bypass"
/ip firewall mangle add chain=prerouting action=accept dst-address-list=LOCAL_BYPASS comment="Local Subnets Bypass"

# 2. Dedicated Client Prioritization (Tier 1)
/ip firewall mangle add chain=prerouting src-address=192.168.88.50 action=mark-routing new-routing-mark=to_ISP1 passthrough=no comment="Priority Client ISP1"

# 3. PCC Classifier (Tier 2)
/ip firewall mangle add chain=prerouting in-interface-list=LAN connection-state=new per-connection-classifier=both-addresses:2/0 action=mark-connection new-connection-mark=ISP1_conn passthrough=yes
/ip firewall mangle add chain=prerouting in-interface-list=LAN connection-state=new per-connection-classifier=both-addresses:2/1 action=mark-connection new-connection-mark=ISP2_conn passthrough=yes

/ip firewall mangle add chain=prerouting connection-mark=ISP1_conn in-interface-list=LAN action=mark-routing new-routing-mark=to_ISP1 passthrough=no
/ip firewall mangle add chain=prerouting connection-mark=ISP2_conn in-interface-list=LAN action=mark-routing new-routing-mark=to_ISP2 passthrough=no
```

---

## 2. Automated 7-Pillar Security Audit Runbook

When auditing a RouterOS v7 configuration, verify each pillar:
1. **DNS Open Resolver:** If `/ip dns get allow-remote-requests` is `true`, verify an input filter drops UDP/53 on WAN.
   - Remediation: `/ip firewall filter add chain=input in-interface-list=WAN protocol=udp dst-port=53 action=drop comment="Drop WAN DNS"`
2. **Service Exposure:** Verify sensitive services (`api`, `api-ssl`, `winbox`, `ssh`, `www`, `www-ssl`) have restricted `address=` values.
   - Remediation: `/ip service set winbox address=192.168.88.0/24`
3. **Mangle Bypass Order:** Verify DST-NAT accept rule is at index 0 in Mangle prerouting.
4. **FIB Registration:** Verify all Mangle `new-routing-mark` values exist in `/routing table` with `fib=yes`.
5. **NTP Time Sync:** Verify `/system ntp client` is enabled and synchronized.
6. **Firewall Filter Input Drop:** Verify `connection-state=invalid` is dropped in the input chain.
7. **Resource Health:** Verify CPU utilization is below 85%.

---

## 3. Tooling & CLI Reference

This repository provides two primary interfaces:
- **CLI (`mtik`):** Standalone terminal executable.
  - `mtik test`: Verify transport connection (REST or Port 8728 binary fallback).
  - `mtik status`: Query CPU load, memory, active interfaces, and DHCP leases.
  - `mtik audit`: Run automated 7-Pillar Security Audit.
  - `mtik mangle`: List rules with index breakdown.
  - `mtik route-force --ip <IP> --table <TABLE>`: Safely apply dedicated routing override.
  - `mtik lease add --ip <IP> --mac <MAC>`: Add static DHCP reservation.
  - `mtik backup`: Export timestamped configuration snapshot.
- **MCP Server (`mtik-mcp`):** Exposes JSON-RPC tools (`mikrotik_test_connection`, `mikrotik_audit_security`, `mikrotik_force_routing`, etc.) directly to IDE AI agents.

---

## 4. Enterprise References

For deep-dive configurations on enterprise modules, consult:
- [Enterprise 802.1X / RADIUS Runbook](./references/radius-8021x.md)
- [Hotspot Captive Portal & Walled Garden](./references/hotspot-portal.md)
- [Modern CAKE & FQ-CoDel QoS](./references/qos-cake.md)
- [WireGuard Zero-Trust VPN](./references/wireguard-vpn.md)
- [Docker Containers on RouterOS v7](./references/docker-containers.md)
