# MikroTik Certified Engineer 5-Layer Troubleshooting Protocol

When investigating network performance degradation, connection timeouts, or misconfigurations, a certified MikroTik engineer never makes blind guesses. Instead, follow this structured, bottom-up 5-layer diagnostic methodology.

---

## 1. Layer 1 & 2: Physical Link, Transceiver & Bridge Integrity

### Objectives:
- Identify cable faults, link negotiation mismatches, duplex mismatches, and SFP optical degradation.
- Verify hardware bridge port status and loop prevention events.

### Diagnostic Commands:
```routeros
# Inspect link negotiation, link flaps, and speed
/interface ethernet monitor ether1 once
# Look for: auto-negotiation=done, rate=1Gbps, full-duplex=yes, link-partner-advertising

# For Fiber / SFP Interfaces: Check Digital Diagnostic Monitoring (DDM) optical levels
/interface ethernet monitor sfp-sfpplus1 once
# Verify: tx-power (should be -3 to -9 dBm), rx-power (should be -3 to -18 dBm, not below -22 dBm)

# Check hardware offloading and loop protection on bridge ports
/interface bridge port print detail
# Ensure 'hw=yes' is active; check if any port is marked 'inactive' or 'discarding' by RSTP
```

---

## 2. Layer 3: IP Addressing, ARP & Routing FIB Health

### Objectives:
- Detect duplicate IP addresses, ARP poisoning, missing default gateways, and FIB routing loops.

### Diagnostic Commands:
```routeros
# Check ARP table for duplicate MACs or incomplete resolution
/ip arp print where incomplete or duplicate
# Verify ARP timeout and interface bindings

# Verify active routes in the Forwarding Information Base (FIB)
/ip route print where active
# In RouterOS v7, ensure expected routes have 'DAC' (Dynamic, Active, Connected) or 'DAc'/'DAv' flags

# Verify custom routing table bindings
/routing table print
# Every custom table must have fib=yes
```

---

## 3. Layer 4: Connection Tracking & Firewall Drop Counters

### Objectives:
- Pinpoint if packets are dropped by stateful filters, NAT failure, or connection tracking exhaustion.

### Diagnostic Commands:
```routeros
# Check Connection Tracking table capacity and utilization
/ip firewall connection tracking print
# Invariant: total-entries should never exceed max-entries (default 262144 or 1048576)

# Find top connections causing packet storms or SYN floods
/ip firewall connection print where tcp-state=syn-sent
/ip firewall connection print stats

# Inspect firewall drop rule hit counters in real time
/ip firewall filter print stats where action=drop
# If packet/byte counters are rapidly incrementing on an unexpected rule, that rule is dropping production traffic
```

---

## 4. Layer 7 & Control Plane: CPU Profiling & Memory Exhaustion

### Objectives:
- Identify CPU spikes caused by firewall misconfigurations, FastTrack bypass, software routing, or rogue scripts.

### Diagnostic Commands:
```routeros
# Profile per-core CPU utilization by subsystem
/tool profile cpu=all duration=5s
# Look for high percentages in:
# - 'firewall': Too many complex regex or un-fasttracked rules
# - 'networking': Excessive software bridging without L2HW/L3HW
# - 'dns': Open resolver attack or high cache misses
# - 'btest': Uncapped bandwidth test running in background

# Check memory and disk health
/system resource print
```

---

## 5. Live Packet Inspection: Torch & Sniffer (Non-Disruptive Capture)

### Objectives:
- Isolate exact source/destination IP, port, protocol, and DSCP marks of active flows on any interface without affecting packet delivery.

### Diagnostic Commands:
```routeros
# Run Torch on an interface to isolate anomalous bandwidth consumers
/tool torch interface=ether1 src-address=0.0.0.0/0 dst-address=0.0.0.0/0 port=any protocol=any duration=5s

# Stream live packets directly to Wireshark via TZSP (TaZmen Sniffer Protocol)
/tool sniffer set streaming-enabled=yes streaming-server=192.168.88.50 filter-interface=ether1
/tool sniffer start
# In Wireshark on workstation 192.168.88.50: capture on interface UDP 37008
/tool sniffer stop
```
