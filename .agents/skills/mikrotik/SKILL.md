---
name: mikrotik
description: "Enterprise network automation, multi-WAN load balancing, security audits, and configuration runbooks for MikroTik RouterOS v7. Use when auditing RouterOS security, setting up dual-WAN failover/PCC, configuring WPA2/WPA3 Enterprise 802.1X RADIUS, deploying CAKE QoS, creating WireGuard tunnels, running containers, or managing IDE MCP integrations."
references:
  - references/radius-8021x.md
  - references/hotspot-portal.md
  - references/qos-cake.md
  - references/wireguard-vpn.md
  - references/docker-containers.md
  - references/rest-api.md
  - references/official-manual-map.md
---

# MikroTik RouterOS v7 Automation & Enterprise Engineering Skill

Production-grade guidance, architecture standards, and operational runbooks for managing MikroTik RouterOS v7 devices through CLI (`mtik`) and Model Context Protocol (`mtik-mcp`).

---

## 1. Core Architectural Directives

All AI agents interacting with or generating configurations for MikroTik devices must strictly comply with these six rules:

1. **RouterOS v7 Exclusivity:** Always use RouterOS v7 syntax. Never generate RouterOS v6 syntax:
   - In v7, routing tables must be explicitly registered under `/routing table add name="<NAME>" fib` before being referenced in Mangle or `/ip route`.
   - In v7, routing rules reside under `/routing rule`, not `/ip route rule`.
   - In v7, use modern CAKE (`kind=cake`) or FQ-CoDel (`kind=fq-codel`) in `/queue type` rather than legacy PCQ for interactive low-latency traffic.
2. **FastTrack vs Mangle Interaction:**
   - The default `fasttrack-connection` firewall rule bypasses Mangle prerouting and queue trees for established TCP/UDP streams.
   - When policy routing (PCC or client override) or CAKE QoS is deployed, you must exempt marked traffic from FastTrack or disable FastTrack:
     ```routeros
     # Exempt policy-routed connections from FastTrack:
     /ip firewall filter set [find action=fasttrack-connection] connection-mark=no-mark
     ```
3. **Vendor-Neutral Terminology:**
   - Never reference specific commercial ISP brand names or public IP addresses in configurations, scripts, or discussions.
   - Always standardize on `ISP1`, `ISP2`, `WAN1`, `WAN2`, `Primary ISP`, or `Secondary ISP`.
4. **Deterministic Mangle Hierarchy:**
   Packets traverse Mangle prerouting sequentially. Ordering violations cause routing loops, broken NAT, or dropped sessions. Rules must be positioned in this strict order:
   - **Tier 0 (Bypass - Indices 0..1):** `connection-nat-state=dstnat action=accept` (preserves Hairpin NAT) and destination address list bypass (`dst-address-list=LOCAL_BYPASS action=accept`).
   - **Tier 1 (Client Overrides):** Specific host/subnet routing rules (`action=mark-routing new-routing-mark=to_ISP1 passthrough=no`).
   - **Tier 2 (PCC Balancer):** Flow classifiers (`per-connection-classifier=both-addresses-and-ports:2/0`) marking connections, followed by routing marks with `passthrough=no`.
   - **Tier 3 (MSS Clamping):** Forward chain `tcp-flags=syn action=change-mss new-mss=clamp-to-pmtu`.
5. **Safe-Mode Watchdog & Visual Diff:**
   - Never execute disruptive routing table changes or firewall filter drops directly.
   - Always run with `--dry-run` or `dryRun: true` first to display an ANSI-colored diff preview.
   - When committing mutations, arm the automated 30-second watchdog rollback scheduler (`mtik_safe_watchdog`) to revert configuration if connectivity drops.
6. **Zero-Leakage Privacy Policy:**
   - Never output real MAC addresses, hardware serial numbers, software IDs, passwords, shared secrets, WireGuard private keys, ZeroTier network IDs, or Cloudflare tunnel tokens.
   - Always invoke `mikrotik_export_sanitized_config` or `mtik backup --sanitize` before sharing router output.

---

## 2. Interactive Advisory & Confirmation-First Protocol (The Anti-Blind Execution Standard)

AI agents operating in this repository must adopt a **consultative, confirmation-first workflow** identical to the `security-audit` and `antislop` guidelines. **Never execute live mutations blindly or assume authorization to reconfigure the user's network.**

### 2.1. The Three Operating Modes

| Mode | Trigger / Context | Agent Behavior | Mutates Router? |
|---|---|---|:---:|
| **Mode 1: Guidance & Diagnostic Audit (Default)** | General questions, troubleshooting reports, performance queries, or security reviews | Safely inspect router (`mikrotik_audit_security`, `mikrotik_get_system_status`, `mikrotik_list_mangle`). Generate an executive assessment with **Numbered Findings (`[F-01]`, `[F-02]`, ...)**, technical impacts, and copy-pasteable remediation commands. | ❌ NO |
| **Mode 2: Staged Review & Dry-Run Diff** | User selects specific findings or asks to prepare a plan | Request user selection of finding IDs. Generate an exact unified diff preview using `dryRun: true` or `--dry-run`. Prompt the user for explicit approval before proceeding. | ❌ NO |
| **Mode 3: Guarded Execution with Watchdog** | Explicit user approval received | Arm the automated 30-second safe-mode watchdog scheduler (`SafeModeWatchdog`). Apply the approved changes. Confirm post-flight device connectivity and disarm the watchdog. | ✅ YES (Guarded) |

---

### 2.2. Interactive Inquiries & Dialog Boxes (`ask_question`)

Whenever user intent is underspecified, or before progressing from an Audit to a Plan or Execution, the agent **must** use the interactive `ask_question` tool (or structured multiple-choice questions in chat) to align on scope and preferences.

#### Pattern 1: Goal Triage & Scoping
When the user gives an ambiguous prompt like "help fix my network" or "check my router":
```json
{
  "questions": [
    {
      "question": "What primary objective would you like to achieve on your MikroTik router?",
      "options": [
        "(Recommended) Run a 7-Pillar Security Audit and produce a diagnostic report",
        "Troubleshoot slow internet or bufferbloat using CAKE QoS",
        "Configure multi-WAN failover or policy routing (PCC)",
        "Deploy a WireGuard Zero-Trust VPN or Docker container"
      ],
      "is_multi_select": false
    }
  ]
}
```

#### Pattern 2: Operating Mode Confirmation
Before touching any configuration or preparing an implementation plan:
```json
{
  "questions": [
    {
      "question": "How would you like to proceed with the recommendations?",
      "options": [
        "(Recommended) Generate a detailed Audit Report with recommendations only (zero mutations)",
        "Prepare an implementation plan with a visual dry-run diff preview",
        "Apply approved remediations directly under a 30-second safe-mode watchdog"
      ],
      "is_multi_select": false
    }
  ]
}
```

#### Pattern 3: Selecting Numbered Findings for Remediation
After generating an audit report with numbered findings (`[F-01]`, `[F-02]`, etc.):
```json
{
  "questions": [
    {
      "question": "Which audit findings would you like to prepare a remediation plan for?",
      "options": [
        "(Recommended) Remediate all CRITICAL and WARN findings",
        "Remediate only CRITICAL findings (e.g. WAN Open DNS Resolver)",
        "Select specific finding IDs manually (e.g. F-01, F-02)",
        "None (keep current configuration, report only)"
      ],
      "is_multi_select": false
    }
  ]
}
```

---

### 2.3. Structured Audit Report Format

When delivering an audit or diagnostic assessment in Mode 1, agents must structure the output in this standardized format:
1. **Header & Device Health Snapshot:** Identity, firmware version, CPU utilization, free memory, and active interface counts.
2. **Executive Assessment Summary:** Clear status badge (`SECURE`, `NEEDS_ATTENTION`, or `VULNERABLE`).
3. **Numbered Findings Table:** Every finding MUST have an ID (`[F-01]`, `[F-02]`, etc.), Pillar, Severity (`CRITICAL`, `WARN`, `PASS`, `INFO`), Title, and technical consequence.
4. **Remediation Action Plan:** Proposed copy-pasteable RouterOS v7 commands for each finding, clearly mapped to finding IDs.
5. **Interactive Confirmation Prompt:** Asking the user which finding IDs they want to remediate or preview.

---

## 3. Operational Decision Trees

### Network Troubleshooting & Performance Triage
```
User reports slow connection or packet drops
├─ Check device health & CPU load
│  └─ mtik status (mikrotik_get_system_status)
│     ├─ CPU > 85% → Check /tool/profile for process hogs (networking, firewall, container)
│     └─ Memory depleted → Check container RAM allocation or large DNS cache
├─ Check link saturation & interface throughput
│  └─ mtik monitor -i WAN1,WAN2 (inspect live RX/TX rates)
│     ├─ Egress saturated → Deploy CAKE bufferbloat limiter (references/qos-cake.md)
│     └─ One WAN idle in dual-WAN → Inspect Mangle PCC counters and check-gateway status
└─ Check DNS resolution latency & open resolver risk
   └─ mtik audit (mikrotik_audit_security)
```

### Routing Modification & Traffic Steering
```
User wants to force a client IP through a specific ISP
├─ 1. Verify routing table existence & FIB flag
│  └─ /routing table print → Ensure target table (e.g. to_ISP1) has fib=yes
├─ 2. Inspect existing Mangle hierarchy
│  └─ mtik mangle (mikrotik_list_mangle)
│     └─ Identify index of last Bypass rule (insert client override immediately after)
├─ 3. Run dry-run preview
│  └─ mtik route-force --ip <IP> --table <TABLE> --dry-run
└─ 4. Apply with Watchdog protection
   └─ mtik route-force --ip <IP> --table <TABLE>
```

### IDE MCP Server Integration
```
User wants to use MikroTik tools inside their AI coding environment
├─ Check target IDE
│  ├─ Antigravity → ~/.gemini/config/mcp_config.json
│  ├─ Cursor → ~/.cursor/mcp.json
│  ├─ Claude Desktop → ~/Library/Application Support/Claude/claude_desktop_config.json
│  ├─ Windsurf → ~/.codeium/windsurf/mcp_config.json
│  └─ All IDEs → --target all
└─ Execute installer
   ├─ Use global binary: mtik install-mcp -t <ide>
   └─ Include current router credentials: mtik install-mcp -t <ide> --with-env
```

---

## 4. Agent Triage & Execution Workflows

### Workflow A: 7-Pillar Security Audit & Hardening
When asked to inspect, harden, or audit router security:
1. **Execute Audit:** Call `mikrotik_audit_security` (or run `mtik audit`).
2. **Evaluate 7 Pillars:**
   - *Pillar 1: DNS Open Resolver:* If `allow-remote-requests=yes`, verify WAN input drop rule for UDP/TCP 53.
   - *Pillar 2: Administrative Service Exposure:* Verify `api`, `winbox`, `ssh`, `www-ssl` are bound to trusted IP ranges (`address=192.168.0.0/16`) or disabled.
   - *Pillar 3: Mangle Hierarchy Integrity:* Verify `connection-nat-state=dstnat action=accept` is at index 0.
   - *Pillar 4: FIB Table Registration:* Verify every `new-routing-mark` has a corresponding `/routing table` entry with `fib=yes`.
   - *Pillar 5: Time Synchronization:* Verify `/system ntp client` is enabled with active servers.
   - *Pillar 6: Firewall Filter Hygiene:* Verify invalid connection drop rule exists in input and forward chains.
   - *Pillar 7: Resource Saturation:* Verify CPU load < 85% and disk usage < 90%.
3. **Generate Remediation Plan:** Output exact, copy-pasteable RouterOS v7 commands for any failing pillars.

### Workflow B: Safe Multi-WAN Traffic Steering
When asked to direct specific devices or traffic through a secondary WAN:
1. Call `mikrotik_list_mangle` to verify rule count and index positions.
2. Confirm the target routing table exists in `/routing table`. If missing, output:
   ```routeros
   /routing table add name="to_ISP2" fib
   /ip route add dst-address=0.0.0.0/0 gateway=<ISP2_GATEWAY> routing-table=to_ISP2 check-gateway=ping
   ```
3. Execute `mikrotik_force_routing` with `dryRun: true`. Show the unified diff to the user.
4. With user confirmation, call `mikrotik_force_routing` with `dryRun: false`. This arms the 30-second rollback watchdog, injects the rule at the correct Tier 1 index, and verifies connectivity.

### Workflow C: Dual-WAN PCC & Recursive Failover Setup
When provisioning multi-WAN load balancing from scratch:
1. Define routing tables with `fib=yes`:
   ```routeros
   /routing table add name="to_ISP1" fib
   /routing table add name="to_ISP2" fib
   ```
2. Configure recursive failover using independent canary DNS hosts:
   ```routeros
   # Canaries (scope 10)
   /ip route add dst-address=1.1.1.1/32 gateway=<ISP1_GW> scope=10 comment="Canary ISP1"
   /ip route add dst-address=8.8.8.8/32 gateway=<ISP2_GW> scope=10 comment="Canary ISP2"

   # Default recursive routes (target-scope 11)
   /ip route add distance=1 gateway=1.1.1.1 check-gateway=ping target-scope=11 comment="Default Primary"
   /ip route add distance=2 gateway=8.8.8.8 check-gateway=ping target-scope=11 comment="Default Secondary"

   # Table specific recursive routes
   /ip route add distance=1 gateway=1.1.1.1 routing-table=to_ISP1 check-gateway=ping target-scope=11
   /ip route add distance=2 gateway=8.8.8.8 routing-table=to_ISP1 target-scope=11

   /ip route add distance=1 gateway=8.8.8.8 routing-table=to_ISP2 check-gateway=ping target-scope=11
   /ip route add distance=2 gateway=1.1.1.1 routing-table=to_ISP2 target-scope=11
   ```
3. Apply PCC Mangle rules with Hairpin NAT protection at index 0 (see Section 4).

### Workflow D: Configuration Export & Public Sanitization
When the user shares configuration snippets or asks to export a backup:
1. Call `mikrotik_export_sanitized_config` or run `mtik backup --sanitize`.
2. Inspect output to ensure:
   - MAC addresses are replaced with `XX:XX:XX:XX:XX:XX`.
   - Serial numbers and software IDs are replaced with `[REDACTED_SERIAL]`.
   - All secret fields (`password=`, `preshared-key=`, `private-key=`, `tunnel-token=`) are masked with `********`.
3. Never store or output unredacted `.rsc` files in public logs.

---

## 5. RouterOS v7 Production Mangle Blueprint

```routeros
# ==========================================================
# TIER 0: BYPASS & HAIRPIN NAT PROTECTION (Index 0..1)
# ==========================================================
/ip firewall mangle add chain=prerouting action=accept connection-nat-state=dstnat \
    comment="[TIER 0] Hairpin NAT Bypass - Must remain at Index 0"
/ip firewall mangle add chain=prerouting action=accept dst-address-list=LOCAL_BYPASS \
    comment="[TIER 0] Local Inter-VLAN Bypass"

# ==========================================================
# TIER 1: CLIENT POLICY ROUTING OVERRIDES (Index 2..N)
# ==========================================================
/ip firewall mangle add chain=prerouting src-address=192.168.88.50 dst-address-type=!local \
    action=mark-routing new-routing-mark=to_ISP1 passthrough=no \
    comment="[TIER 1] Dedicated Workstation -> ISP1"

# ==========================================================
# TIER 2: PCC CONNECTION & ROUTING CLASSIFIERS
# ==========================================================
# Connection Marking (hash: both-addresses-and-ports)
/ip firewall mangle add chain=prerouting in-interface-list=LAN dst-address-type=!local connection-state=new \
    per-connection-classifier=both-addresses-and-ports:2/0 action=mark-connection new-connection-mark=ISP1_conn passthrough=yes \
    comment="[TIER 2] PCC Stream 1/2 -> ISP1"
/ip firewall mangle add chain=prerouting in-interface-list=LAN dst-address-type=!local connection-state=new \
    per-connection-classifier=both-addresses-and-ports:2/1 action=mark-connection new-connection-mark=ISP2_conn passthrough=yes \
    comment="[TIER 2] PCC Stream 2/2 -> ISP2"

# Routing Marking based on Connection Mark
/ip firewall mangle add chain=prerouting connection-mark=ISP1_conn in-interface-list=LAN \
    action=mark-routing new-routing-mark=to_ISP1 passthrough=no comment="[TIER 2] Route ISP1 Stream"
/ip firewall mangle add chain=prerouting connection-mark=ISP2_conn in-interface-list=LAN \
    action=mark-routing new-routing-mark=to_ISP2 passthrough=no comment="[TIER 2] Route ISP2 Stream"

# ==========================================================
# TIER 3: MSS CLAMPING (Path MTU Discovery Fix)
# ==========================================================
/ip firewall mangle add chain=forward protocol=tcp tcp-flags=syn action=change-mss \
    new-mss=clamp-to-pmtu comment="[TIER 3] Clamp MSS to PMTU"
```

---

## 6. RouterOS v7 vs v6 Critical Compatibility Matrix

| Feature | RouterOS v6 (Legacy) | RouterOS v7 (Production Standard) | Agent Action |
|---|---|---|---|
| **Routing Tables** | Implicitly created when routing mark used | Must be explicitly added in `/routing table add name=X fib` | Always check `/routing table` before marking |
| **Routing Rules** | `/ip route rule` | `/routing rule` | Use `/routing rule` syntax |
| **Failover Check** | `check-gateway=ping` on direct gateway | Recursive routing with `scope=10` and `target-scope=11` | Avoid pinging local gateway; ping upstream canaries |
| **QoS Queuing** | Simple Queues (FIFO / PCQ) | CAKE (`kind=cake`) & FQ-CoDel | Deploy CAKE for anti-bufferbloat |
| **Containers** | Not supported | Supported via native `/container` on ARM/x86 | Mount rootfs on USB/SSD storage |
| **DNS Adblocking** | Complex static regex lists | Native `/ip dns adlist` | Use `/ip dns adlist add url=...` |
| **API Transport** | Port 8728 / 8729 proprietary binary socket | REST API over HTTPS 443 + Binary fallback | Use REST API primarily; fall back to 8728 |

---

## 7. Troubleshooting & Recovery Matrix

| Symptom / Error Signature | Root Cause | Remediation Command |
|---|---|---|
| `failure: already have such routing mark` | Custom routing table not declared in v7 kernel FIB | `/routing table add name="<NAME>" fib` |
| Policy routed clients lose internal LAN access | Missing `dst-address-type=!local` or Tier 0 bypass | Add `dst-address-type=!local` to mark-routing rules |
| Hairpin NAT loop / cannot open local port forwards | Mangle prerouting marks packet before DST-NAT | Place `action=accept connection-nat-state=dstnat` at index 0 |
| QoS queue shows 0 bps despite heavy traffic | FastTrack is bypassing Mangle and Queue trees | Set `connection-mark=no-mark` on FastTrack rule |
| Container fails to start (`error: disk full`) | Container written to internal NAND flash | Set `root-dir=usb1/...` and `tmpdir=usb1/tmp` |
| CLI connection refused | REST API service (`www` or `www-ssl`) disabled | `/ip service enable www-ssl` or use port 8728 binary API |

---

## 8. Tooling & Integration Reference

### Global CLI (`mtik`)
```bash
# Connectivity & Diagnostics
mtik test                                     # Test REST / Port 8728 connection and measure latency
mtik status                                   # Inspect CPU load, memory, active interfaces, DHCP leases
mtik monitor -i ether1,ether2                 # Live terminal throughput and packet rate monitor
mtik profile [--save <name>|--switch <name>]  # Manage multiple router connection profiles

# Security & Safety
mtik audit                                    # Execute 7-Pillar Security Audit
mtik backup [--sanitize]                      # Structured backup (with optional sanitization)

# Routing & Traffic Steering
mtik mangle                                   # Display mangle rules with hierarchy index analysis
mtik route-force --ip <IP> --table <TABLE>    # Apply policy routing with dry-run diff & watchdog

# Network Services & Containers
mtik lease --add --ip <IP> --mac <MAC>        # Add static DHCP lease reservation
mtik container [list|--restart <id>]          # List and manage Docker containers
mtik adlist [list|--add <url>]                # Inspect or register DNS sinkhole blocklists

# IDE MCP Setup
mtik install-mcp -t <antigravity|cursor|claude|windsurf|all> [--with-env]
```

### Model Context Protocol (`mtik-mcp`) Tools
- `mikrotik_test_connection`: Verifies device connectivity, authentication, and transport mode (REST HTTPS or Binary 8728).
- `mikrotik_get_system_status`: Returns CPU load, memory usage, RouterOS version, uptime, and active interface link status.
- `mikrotik_audit_security`: Performs automated 7-pillar security audit and returns findings with remediation commands.
- `mikrotik_list_mangle`: Fetches all firewall mangle rules with index ordering and tier classifications.
- `mikrotik_force_routing`: Directs an IP address to a routing table. Supports `dryRun: true` for unified diff preview and automated 30s watchdog rollback.
- `mikrotik_manage_dhcp_lease`: Queries active leases and registers static IP/MAC bindings.
- `mikrotik_export_sanitized_config`: Exports full router configuration with all MACs, passwords, serials, and private tokens redacted.
- `mikrotik_manage_container`: Lists running container status and initiates container restarts.
- `mikrotik_get_adlist_status`: Queries status of `/ip dns adlist` malware/adblocker feeds.

---

## 9. Enterprise Reference Architecture Guides

For detailed, step-by-step implementation templates, refer to:
- [RouterOS v7 REST API Architecture & Semantics](./references/rest-api.md)
- [Official Manual Architecture & LLM Retrieval Map](./references/official-manual-map.md)
- [WPA2/WPA3-Enterprise 802.1X & Dynamic VLAN Assignment](./references/radius-8021x.md)
- [Responsive Captive Portal & Walled Garden](./references/hotspot-portal.md)
- [Modern CAKE & FQ-CoDel Anti-Bufferbloat QoS](./references/qos-cake.md)
- [WireGuard Remote-Access & Site-to-Site VPN](./references/wireguard-vpn.md)
- [Docker Microservices & Container Networking](./references/docker-containers.md)

---

## 10. Official Documentation Retrieval for AI Agents

When verifying unfamiliar RouterOS v7 syntax, switch chip capabilities, or new API endpoints:
1. **Never Hallucinate Flags:** RouterOS syntax varies strictly between minor versions and hardware models.
2. **Retrieve via Machine-Readable Endpoints:**
   - **Table of Contents Index:** Fetch `https://manual.mikrotik.com/llms.txt` to find the exact documentation slug.
   - **Direct Raw Markdown:** Append `.md` to the documentation URL (e.g. `https://manual.mikrotik.com/docs/developer-guides/rest-api.md`) to ingest the unformatted source directly.
   - **CLI Reference Lookup:** Consult `https://manual.mikrotik.com/docs/cli-reference/` for machine-extracted properties and default values.
3. **REST API Invariants:**
   - Values returned by the REST API are always string-encoded in JSON.
   - Continuous commands (`monitor`, `ping`, `bandwidth-test`) require limiting arguments (`once: ""`, `count: "4"`, `duration: "3s"`) to avoid 60-second timeouts.
   - Batch script executions can be sent atomically to `/rest/execute`.
