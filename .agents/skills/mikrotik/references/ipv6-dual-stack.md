# Enterprise IPv6 Dual-Stack Architecture & RFC 4890 Firewall Security

Deploying IPv6 in enterprise networks requires a disciplined approach to prefix delegation, address autoconfiguration (SLAAC), and stateful firewall filtering. Blindly copying IPv4 firewall rules to IPv6 will break network connectivity.

---

## 1. Upstream DHCPv6 Client with Prefix Delegation (PD)

Enterprise ISPs delegate IPv6 prefixes (typically `/56` or `/60`) dynamically or statically to customer edge routers.

```routeros
# 1. Request a /56 Prefix from the Upstream ISP
/ipv6 dhcp-client
add interface=ether1 request=prefix pool-name=isp-ipv6-pool pool-prefix-length=64 use-peer-dns=yes

# 2. Distribute /64 Subnets to Internal VLAN Interfaces from the Pool
/ipv6 address
add from-pool=isp-ipv6-pool interface=vlan10-staff advertise=yes
add from-pool=isp-ipv6-pool interface=vlan20-iot advertise=yes

# 3. Configure IPv6 Neighbor Discovery (ND) & SLAAC
/ipv6 nd
set [find default=yes] disabled=yes
add interface=vlan10-staff managed-address-configuration=no other-configuration=yes \
    advertise-mac-address=yes advertise-dns=yes ra-interval=20s-60s
add interface=vlan20-iot managed-address-configuration=no other-configuration=yes \
    advertise-mac-address=yes advertise-dns=yes ra-interval=20s-60s
```

---

## 2. The Golden Rule of IPv6: RFC 4890 ICMPv6 Invariants

In IPv4, ICMP can be aggressively dropped with minimal side effects. In IPv6, **ICMPv6 is an integral part of the IP stack**. Dropping ICMPv6 unconditionally breaks:
- **Neighbor Discovery Protocol (NDP):** Replaces ARP; without NDP, hosts cannot discover local gateways.
- **Path MTU Discovery (PMTUD):** IPv6 routers never fragment packets; packet size is negotiated via ICMPv6 Packet Too Big messages.
- **Router Advertisement (RA):** Informs hosts of available prefixes and gateways.

---

## 3. RFC-Compliant Enterprise IPv6 Firewall Filter

```routeros
/ipv6 firewall filter

# ================= INPUT CHAIN (ROUTER ITSELF) =================
# 1. Accept Established, Related, Untracked
add chain=input connection-state=established,related,untracked action=accept comment="Accept established/related"

# 2. Drop Invalid Connections
add chain=input connection-state=invalid action=drop comment="Drop invalid IPv6 packets"

# 3. Accept Essential ICMPv6 Messages (RFC 4890)
add chain=input protocol=icmpv6 icmp-options=1:0 action=accept comment="Accept Destination Unreachable"
add chain=input protocol=icmpv6 icmp-options=2:0 action=accept comment="Accept Packet Too Big"
add chain=input protocol=icmpv6 icmp-options=3:0-1 action=accept comment="Accept Time Exceeded"
add chain=input protocol=icmpv6 icmp-options=4:0-2 action=accept comment="Accept Parameter Problem"
add chain=input protocol=icmpv6 icmp-options=128:0 action=accept comment="Accept Echo Request (Ping)"
add chain=input protocol=icmpv6 icmp-options=133:0 action=accept comment="Accept Router Solicitation"
add chain=input protocol=icmpv6 icmp-options=134:0 action=accept comment="Accept Router Advertisement"
add chain=input protocol=icmpv6 icmp-options=135:0 action=accept comment="Accept Neighbor Solicitation"
add chain=input protocol=icmpv6 icmp-options=136:0 action=accept comment="Accept Neighbor Advertisement"

# 4. Accept DHCPv6 Client Traffic from ISP (UDP port 546)
add chain=input protocol=udp src-port=547 dst-port=546 in-interface=ether1 action=accept comment="Accept DHCPv6 PD response"

# 5. Drop Rogue External Access to Management Services
add chain=input in-interface-list=!LAN action=drop comment="Drop non-LAN input"


# ================= FORWARD CHAIN (TRANSIT TRAFFIC) =================
# 1. Accept Established, Related, Untracked
add chain=forward connection-state=established,related,untracked action=accept comment="Accept established/related"

# 2. Drop Invalid Connections
add chain=forward connection-state=invalid action=drop comment="Drop invalid transit"

# 3. Accept Essential ICMPv6 Forwarding (RFC 4890 PMTUD)
add chain=forward protocol=icmpv6 icmp-options=1:0 action=accept comment="Accept Destination Unreachable"
add chain=forward protocol=icmpv6 icmp-options=2:0 action=accept comment="Accept Packet Too Big"
add chain=forward protocol=icmpv6 icmp-options=3:0-1 action=accept comment="Accept Time Exceeded"
add chain=forward protocol=icmpv6 icmp-options=4:0-2 action=accept comment="Accept Parameter Problem"
add chain=forward protocol=icmpv6 icmp-options=128:0 action=accept comment="Accept Echo Request"

# 4. Allow Outgoing Traffic from Trusted LAN to WAN
add chain=forward in-interface-list=LAN out-interface-list=WAN action=accept comment="Allow LAN to Internet"

# 5. Drop All Inbound Connections from WAN (Stateful Firewall)
add chain=forward in-interface-list=WAN action=drop comment="Drop unsolicited inbound from WAN"
```
