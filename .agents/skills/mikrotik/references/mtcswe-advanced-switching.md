# MTCSWE: Advanced Switching, LACP Bonding & Multicast Optimization

The MikroTik Certified Switching Engineer (MTCSWE) curriculum focuses on enterprise hardware switching, Layer 2 link aggregation, multicast containment, port isolation, and hardware spanning tree protocols on MikroTik CRS3xx/CRS5xx and CCR series.

---

## 1. Link Aggregation (LACP / 802.3ad Bonding)

Bonding aggregates multiple physical Ethernet ports into a single logical link, providing link redundancy and increased bandwidth.

### Certified Configuration Rules:
1. **L2MTU Consistency:** All slave interfaces in a bond MUST share the exact same `l2mtu` size.
2. **Transmit Hash Policy:** Always use `layer-3-and-4` (or `layer-2-and-3`) to balance flows across multiple IP connections. The default `layer-2` only balances by MAC address, sending all routed traffic across a single link.
3. **Hardware Offloading on CRS3xx:** RouterOS v7 supports hardware-offloaded bonding on Marvell Prestera switch chips when using `802.3ad` or `balance-xor`.

```routeros
# 1. Create LACP (802.3ad) Bond Interface with Layer 3+4 Hashing
/interface bonding
add name=bond-core slaves=ether1,ether2 mode=802.3ad \
    transmit-hash-policy=layer-3-and-4 lacp-rate=fast \
    min-links=1 link-monitoring=mii

# 2. Add Bond to the Unified Hardware Bridge
/interface bridge port
add bridge=bridge1 interface=bond-core frame-types=admit-only-vlan-tagged \
    ingress-filtering=yes comment="Trunk uplink to Distribution Switch"
```

---

## 2. Multicast Optimization: IGMP & MLD Snooping

Without IGMP Snooping, Layer 2 switches treat multicast packets (IPTV, video streams, discovery protocols) as broadcast frames, flooding them out of every bridge port and choking 100M/1G links.

### Certified Bridge Snooping Setup:
```routeros
# Enable IGMP (IPv4) and MLD (IPv6) Snooping on Bridge
/interface bridge set bridge1 \
    igmp-snooping=yes \
    mld-snooping=yes \
    multicast-router=temporary-query

# Designate specific port facing the Multicast Source / Querier
/interface bridge port set [find interface=bond-core] \
    multicast-router=permanent \
    fast-leave=yes
```

---

## 3. Port Isolation (Private VLAN / Edge Isolation)

In enterprise edge switches, access ports (e.g. hotel rooms, student dorms, CCTV cameras) should not communicate directly with each other at Layer 2, even when sharing the same VLAN subnet.

```routeros
# Configure Port Isolation Profile:
# Ports assigned to isolation group 1 can ONLY talk to uplink ports (not to each other)
/interface bridge port
set [find interface=ether3] pvid=10 frame-types=admit-only-untagged-and-priority-tagged \
    point-to-point=yes bpdu-guard=yes edge=yes horizon=1

set [find interface=ether4] pvid=10 frame-types=admit-only-untagged-and-priority-tagged \
    point-to-point=yes bpdu-guard=yes edge=yes horizon=1

# Uplink port (bond-core) has no horizon (horizon=none), so all isolated ports can reach it
set [find interface=bond-core] horizon=none
```

---

## 4. Hardware Multiple Spanning Tree Protocol (MSTP)

When running multiple VLANs, RSTP treats all VLANs as a single tree. If a link is blocked by RSTP, all VLANs on that link are blocked. **MSTP** maps distinct VLAN groups to separate spanning tree instances (MSTI), allowing load sharing across uplinks.

```routeros
# Configure MSTP on Bridge
/interface bridge set bridge1 protocol-mode=mstp region-name="CAMPUS-REGION" region-revision=1

# Map VLAN 10-20 to MSTI 1, VLAN 30-40 to MSTI 2
/interface bridge msti
add bridge=bridge1 identifier=1 vlan-mapping=10-20 priority=0x1000
add bridge=bridge1 identifier=2 vlan-mapping=30-40 priority=0x2000
```

---

## 5. Jumbo Frames & L2MTU Planning

To support encapsulated payloads (MPLS, VXLAN, WireGuard, EoIP) without IP fragmentation, configure maximum Layer 2 MTU:

```routeros
# Set physical port MTU to maximum hardware capability (usually 9216 or 10218 bytes on CRS3xx)
/interface ethernet set [find] l2mtu=10218

# Verify L2MTU across all bridge ports
/interface print where type=ether
```
