# RouterOS v7 Enterprise Dynamic Routing (OSPFv3 & BGP Multi-Homing)

An enterprise engineer certified in MTCRE and MTCINE must master the completely overhauled RouterOS v7 routing stack. RouterOS v7 replaces the legacy v6 Quagga/Zebra daemon with a native asynchronous multiprocessor routing engine.

---

## 1. The Core Architectural Differences (v6 vs v7)

| Routing Feature | RouterOS v6 (Legacy) | RouterOS v7 (Modern Standard) |
|---|---|---|
| **Routing Tables** | Dynamic string-based (`/ip route mark=...`) | Explicit registration required: `/routing table add name=to_ISP1 fib` |
| **BGP Peers** | Single menu: `/routing bgp peer` | Decoupled: `/routing bgp template` + `/routing bgp connection` |
| **BGP Multi-core** | Single-threaded process (bottleneck on high core counts) | Multi-threaded asynchronous workers; feeds full Internet routing table in seconds |
| **Routing Filters** | Simple chain rules (`/routing filter`) | Full scripting language with syntax expressions: `/routing filter rule add ...` |
| **OSPFv2 / OSPFv3** | Separate instances for IPv4 and IPv6 | Unified OSPFv3 supporting both IPv4 (AFI 1) and IPv6 (AFI 2) address families |

---

## 2. BGP Multi-Homing Configuration Template

Scenario:
- Dual-homed autonomous system (`ASN 65001`) with two upstream transit providers:
  - `ISP1`: Remote ASN `64512`, Gateway `198.51.100.1` (Primary transit).
  - `ISP2`: Remote ASN `64513`, Gateway `203.0.113.1` (Backup transit with AS-Path prepending).
- Local Public Prefix: `192.0.2.0/24`.

```routeros
# 1. Define Local AS and BGP Template
/routing bgp template
add name=TRANSIT-TMPL as=65001 router-id=192.0.2.1 hold-time=90s keepalive-time=30s output.network=bgp-networks

# 2. Define Routing Filter Rules for Outbound Prefixes and AS-Path Prepending
/routing filter rule
add chain=BGP-OUT-PRIMARY rule="if (dst == 192.0.2.0/24) { accept; } else { reject; }"
add chain=BGP-OUT-BACKUP  rule="if (dst == 192.0.2.0/24) { set bgp-path-prepend 2; accept; } else { reject; }"

# Filter for Default-Route Only from Providers (protecting router RAM)
/routing filter rule
add chain=BGP-IN-DEFAULT-ONLY rule="if (dst == 0.0.0.0/0) { accept; } else { reject; }"

# 3. Create BGP Connections to Both Upstream Providers
/routing bgp connection
add name=bgp-to-ISP1 template=TRANSIT-TMPL remote.address=198.51.100.1 remote.as=64512 \
    output.filter-chain=BGP-OUT-PRIMARY input.filter-chain=BGP-IN-DEFAULT-ONLY \
    connect=yes listen=yes

add name=bgp-to-ISP2 template=TRANSIT-TMPL remote.address=203.0.113.1 remote.as=64513 \
    output.filter-chain=BGP-OUT-BACKUP input.filter-chain=BGP-IN-DEFAULT-ONLY \
    connect=yes listen=yes

# 4. Register Local Prefix in BGP Address List
/ip firewall address-list
add list=bgp-networks address=192.0.2.0/24
```

---

## 3. OSPFv3 Enterprise Interior Routing Template

Scenario:
- Backbone Area (`0.0.0.0`) interconnecting Core, Distribution, and Edge routers.
- Redistribute default route and connected subnets.

```routeros
# 1. Create OSPFv3 Instance
/routing ospf instance
add name=ospf-instance-1 router-id=10.255.255.1 version=3 redistribute=connected

# 2. Define Backbone Area
/routing ospf area
add name=backbone area-id=0.0.0.0 instance=ospf-instance-1

# 3. Attach Interfaces with Interface Templates
/routing ospf interface-template
add area=backbone networks=10.0.0.0/24 type=ptp cost=10 auth=sha256 auth-key="StrongEnterpriseSecret"
add area=backbone networks=10.10.0.0/16 passive=yes
```

---

## 4. Policy-Based Routing (PBR) & Recursive Route Invariants

### Recursive Route Failover (Virtual IP SLA)
To verify real internet reachability beyond the physical ISP gateway:
```routeros
# Target 1.1.1.1 pinned strictly via ISP1 Gateway
/ip route
add dst-address=1.1.1.1/32 gateway=198.51.100.1 scope=10

# Target 9.9.9.9 pinned strictly via ISP2 Gateway
add dst-address=9.9.9.9/32 gateway=203.0.113.1 scope=10

# Primary Default Route recursing through 1.1.1.1 with ICMP keepalive
add dst-address=0.0.0.0/0 gateway=1.1.1.1 check-gateway=ping distance=1 target-scope=11

# Secondary Default Route recursing through 9.9.9.9
add dst-address=0.0.0.0/0 gateway=9.9.9.9 check-gateway=ping distance=2 target-scope=11
```
*Certified Engineer Invariant:* `scope=10` on the target route matches `target-scope=11` (where `target-scope >= scope`) on the recursive default route.
