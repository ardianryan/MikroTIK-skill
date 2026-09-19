# Enterprise Bridge VLAN Filtering & Switching Architecture (CRS3xx / RB Series)

An enterprise engineer certified in MTCNA/MTCRE must deploy modern Bridge VLAN Filtering (`vlan-filtering=yes`). In RouterOS v7, legacy switch-chip menus (`/interface ethernet switch vlan`) and multiple separate software bridges are strictly deprecated in favor of a unified hardware-offloaded bridge.

---

## 1. Core Principles of Bridge VLAN Filtering

1. **One Bridge to Rule Them All:**
   Never create multiple software bridges on a single router/switch. Create a single bridge (e.g. `bridge-lan`) with all member ports, and isolate broadcast domains via VLAN IDs.
2. **Hardware Offloading (`hw=yes`):**
   Bridge member ports automatically offload L2 packet forwarding to the physical switch ASIC (Marvell Prestera, Realtek, or Qualcomm) when hardware offload is enabled.
3. **PVID (Port VLAN ID):**
   Determines the default VLAN assigned to untagged ingress frames entering an access port.
4. **Ingress Filtering & Frame Types:**
   Strictly drop rogue untagged frames on trunk ports and drop tagged frames on access ports.

---

## 2. Port Persona Matrix

| Port Type | Role | `frame-types` Setting | `pvid` Setting | Bridge VLAN Table Entry |
|---|---|---|---|---|
| **Trunk Port** | Uplink to switch, router, or AP | `admit-only-vlan-tagged` | Default (`1`) | Listed in `tagged=...` for all carried VLANs |
| **Access Port** | End-user PC, printer, camera | `admit-only-untagged-and-priority-tagged` | Target VLAN (e.g. `10`) | Listed in `untagged=...` (auto-dynamically added by ROS) |
| **Hybrid Port** | VoIP phone with PC daisy-chained | `admit-all` | Native VLAN (e.g. `10`) | Native VLAN in `untagged=...`, Voice VLAN (e.g. `20`) in `tagged=...` |

---

## 3. Production Deployment Script (Trunk, Access & Router L3 Inter-VLAN)

Scenario:
- Router interface `bridge` acts as L3 Gateway for VLAN 10 (Staff: `10.10.10.0/24`) and VLAN 20 (IoT: `10.20.20.0/24`).
- `ether1`: Trunk uplink carrying VLAN 10 and 20.
- `ether2`: Access port for Staff (VLAN 10).
- `ether3`: Access port for IoT (VLAN 20).

```routeros
# 1. Create the unified Bridge (KEEP vlan-filtering=no during initial configuration to prevent lockout)
/interface bridge
add name=bridge1 vlan-filtering=no ingress-filtering=yes dhcp-snooping=yes

# 2. Assign Bridge Member Ports with explicit PVIDs and Frame Types
/interface bridge port
add bridge=bridge1 interface=ether1 frame-types=admit-only-vlan-tagged ingress-filtering=yes
add bridge=bridge1 interface=ether2 frame-types=admit-only-untagged-and-priority-tagged pvid=10 ingress-filtering=yes
add bridge=bridge1 interface=ether3 frame-types=admit-only-untagged-and-priority-tagged pvid=20 ingress-filtering=yes

# 3. Configure Bridge VLAN Table (Notice: bridge1 itself MUST be tagged if ROS acts as L3 Gateway)
/interface bridge vlan
add bridge=bridge1 tagged=bridge1,ether1 untagged=ether2 vlan-ids=10
add bridge=bridge1 tagged=bridge1,ether1 untagged=ether3 vlan-ids=20

# 4. Create Virtual VLAN Interfaces for L3 IP Addressing
/interface vlan
add name=vlan10-staff vlan-id=10 interface=bridge1
add name=vlan20-iot vlan-id=20 interface=bridge1

# 5. Assign L3 Gateway IP Addresses
/ip address
add address=10.10.10.1/24 interface=vlan10-staff
add address=10.20.20.1/24 interface=vlan20-iot

# 6. ARM THE BRIDGE (Turn on VLAN filtering)
/interface bridge set bridge1 vlan-filtering=yes
```

---

## 4. Spanning Tree Protocol (RSTP / MSTP) & Loop Protection

Always secure bridge ports against rogue switches and accidental patch cable loops:

```routeros
# Enable Rapid Spanning Tree Protocol (RSTP)
/interface bridge set bridge1 protocol-mode=rstp priority=0x8000

# Protect Access Ports with BPDU Guard and Edge Port Designation
/interface bridge port set [find pvid=10] bpdu-guard=yes edge=yes
/interface bridge port set [find pvid=20] bpdu-guard=yes edge=yes
```

---

## 5. L3 Hardware Offloading (`l3hw`) on Switch Chips

On enterprise CRS3xx series switches and CCR2004 routers with Marvell Prestera silicon:
- Inter-VLAN routing can be processed directly at ASIC wire speed (up to 100 Gbps) without touching the CPU.
- Enable L3HW offloading:
  ```routeros
  /interface ethernet switch set 0 l3-hw-offloading=yes
  ```
- Verify status:
  ```routeros
  /interface ethernet switch print
  # Check that 'l3-hw-offloading: yes' is active.
  ```
