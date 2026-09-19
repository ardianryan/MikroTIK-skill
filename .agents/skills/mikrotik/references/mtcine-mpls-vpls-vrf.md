# MTCINE: Enterprise Inter-Networking, MPLS, VPLS & VRF Multi-Tenancy

The MikroTik Certified Inter-networking Engineer (MTCINE) curriculum represents the highest engineering tier for Service Provider and Enterprise Campus backbones. It covers MPLS label distribution, transparent Layer 2 VPLS tunnels, Virtual Routing and Forwarding (VRF) segmentation, and advanced BGP policy tuning in RouterOS v7.

---

## 1. RouterOS v7 MPLS Architecture & LDP Configuration

In RouterOS v7, MPLS is deeply integrated into the Linux kernel routing pipeline. Label Distribution Protocol (LDP) automatically exchanges labels for routes in the routing table.

### Certified Engineer Prerequisite:
- Always bind LDP `lsr-id` and `transport-address` to a stable Loopback bridge interface (`bridge-lo0`), NEVER to a physical Ethernet port that could flap.

```routeros
# 1. Create Loopback Interface and Assign IP
/interface bridge add name=bridge-lo0 comment="MPLS System Loopback"
/ip address add address=10.255.255.1/32 interface=bridge-lo0

# 2. Configure IGP (OSPF) to Advertise Loopback IP Across Core
/routing ospf instance add name=ospf-core router-id=10.255.255.1
/routing ospf area add name=backbone area-id=0.0.0.0 instance=ospf-core
/routing ospf interface-template
add area=backbone networks=10.255.255.1/32 passive=yes
add area=backbone networks=10.0.0.0/24 type=ptp

# 3. Configure MPLS and LDP in RouterOS v7
/mpls
set dynamic-label-range-start=100

/mpls ldp
add lsr-id=10.255.255.1 transport-address=10.255.255.1 afi=ipv4

# 4. Enable LDP on Core Transit Interfaces
/mpls ldp interface
add interface=ether1 afi=ipv4 comment="Core Link to PE-Router-2"
```

---

## 2. Transparent Layer 2 VPN (VPLS Tunnels)

VPLS allows enterprise customers to extend an Ethernet broadcast domain across a wide-area MPLS backbone, connecting two geographically separated offices as if they were plugged into the same local switch.

```routeros
# Create VPLS Interface to Remote Provider Edge (PE) Router
/interface vpls
add name=vpls-custA remote-peer=10.255.255.2 vpls-id=100:100 \
    cisco-style=yes cisco-style-id=100 disabled=no

# Bridge the VPLS Tunnel Directly into Customer VLAN
/interface bridge port
add bridge=bridge-custA interface=vpls-custA
add bridge=bridge-custA interface=ether5 comment="Customer Access Port"
```

---

## 3. VRF (Virtual Routing and Forwarding) Multi-Tenancy

VRF allows multiple isolated routing tables to coexist on the same physical router with overlapping IP address spaces (e.g. Tenant A using `192.168.1.0/24` and Tenant B using `192.168.1.0/24`).

```routeros
# 1. Register Custom Routing Tables with FIB in RouterOS v7
/routing table
add name=VRF_TENANT_A fib
add name=VRF_TENANT_B fib

# 2. Define VRFs with Interface Bindings
/ip vrf
add name=VRF_TENANT_A interfaces=vlan10-custA routing-mark=VRF_TENANT_A
add name=VRF_TENANT_B interfaces=vlan20-custB routing-mark=VRF_TENANT_B

# 3. Add Isolated Default Gateways for Each Tenant
/ip route
add dst-address=0.0.0.0/0 gateway=198.51.100.1@main routing-table=VRF_TENANT_A
add dst-address=0.0.0.0/0 gateway=203.0.113.1@main routing-table=VRF_TENANT_B
```

---

## 4. Advanced BGP v7 Communities & Policy Control

BGP Communities tag routes with specific metadata for policy steering across autonomous systems.

```routeros
# 1. Tag Outbound Routes with Standard Community (e.g. 65001:100 = Primary)
/routing filter rule
add chain=BGP-PEER-OUT rule="
    if (dst == 192.0.2.0/24) {
        set bgp-communities 65001:100;
        set bgp-med 10;
        accept;
    }
"

# 2. Route Reflector Configuration in RouterOS v7
/routing bgp template
add name=RR-CLIENT-TMPL as=65001 router-id=10.255.255.1 \
    route-reflect=yes cluster-id=1.1.1.1
```
