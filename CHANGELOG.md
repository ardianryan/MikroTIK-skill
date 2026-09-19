# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-09-19

### Added
- **Official RouterOS v7 REST API Deep Dive (`references/rest-api.md`):**
  - Exhaustive documentation of RouterOS v7 REST API architecture, HTTP verb mappings (GET, PUT, PATCH, DELETE, POST), stringified JSON serialization, `.proplist` property projections, and `.query` stack filters.
  - Documented timeout semantics (60-second limit) and mandatory bounding parameters (`once: ""`, `count`, `duration`) for continuous commands.
  - Documented `/rest/execute` script evaluation, `/rest/export` configuration dumping, and `/rest/<menu>/move` rule re-indexing.
- **Official Manual Architecture & LLM Retrieval Map (`references/official-manual-map.md`):**
  - Architectural map of the official Docusaurus platform at `manual.mikrotik.com`.
  - Added AI retrieval guidelines for machine-readable endpoints: `/llms.txt`, `/llms-full.txt`, direct per-page `.md` ingestion, and the auto-generated CLI Reference.
- **Expanded REST Client Capabilities (`RouterOsRestClient`):**
  - Added `executeScript(script)` for atomic script execution via `/rest/execute`.
  - Added `exportConfig(options)` for compact/file export via `/rest/export`.
  - Added `moveRule(menu, id, destinationId)` for rule reordering via `/rest/<menu>/move`.
  - Added `queryMenu(menu, options)` for query stack filtering with `.proplist` and `.query`.
  - Added unit test suite `test/rest-client.test.ts` (bringing test suite to 20 tests).

## [1.0.1] - 2026-09-18

### Added
- **IDE MCP Installer (`mtik install-mcp`):**
  - Automated installer configuring the MikroTik MCP server into Antigravity, Cursor, Claude Desktop, Windsurf, or all detected IDEs simultaneously.
  - Supports `--target <ide>`, `--global` (using `mtik-mcp` binary in PATH), and `--with-env` (injecting credentials from active `.env`).
  - Automatic synchronization of `.agents/skills/mikrotik/` to `~/.gemini/config/skills/mikrotik/`.
- **Comprehensive Agent Skill & Engineering Standards (`SKILL.md`):**
  - Added visual operational decision trees for network triage, policy routing, and MCP setups.
  - Added RouterOS v7 vs v6 compatibility matrix covering kernel FIB tables, `/routing rule`, and CAKE QoS.
  - Added FastTrack vs Mangle conflict rules and exemption techniques.
  - Added error troubleshooting & recovery matrix with specific remediation commands.
  - Added full MCP and CLI tool reference specifications with input/output contracts.
  - Added unit test suite `test/installer.test.ts`.

## [1.0.0] - 2026-09-18

### Initial Release

The initial production release of the **MikroTik RouterOS v7 Skill & CLI Toolkit**, engineered for network automation, multi-WAN load balancing, automated security audits, and AI agent integration via Model Context Protocol (MCP).

#### Core Connectivity
- **Dual-Engine Connection:** Primary high-speed RouterOS v7 REST API (`/rest`, HTTPS 443 / HTTP 80) with automatic transparent fallback to native RouterOS binary socket (Port 8728 / 8729 SSL).
- **Multi-Router Profile Switcher (`mtik profile`):** Support for switching between router targets stored securely in `~/.mtik/profiles.json` with restricted `0600` permissions.

#### Safety & Security Layer
- **Automated 7-Pillar Security Auditor (`mtik audit`):** Automated evaluation of DNS open resolvers, unhardened management services, missing firewall input drops, NTP drift, and Hairpin NAT bypass ordering.
- **Deterministic Mangle Hierarchy:** Enforces packet processing order (Bypass $\rightarrow$ Dedicated Route Override $\rightarrow$ PCC Load Balancing).
- **FIB Integrity Validation:** Pre-execution verification of custom routing tables in `/routing table` with `fib=yes`.
- **30-Second Safe-Mode Watchdog:** Automated scheduler-based rollback mechanism preventing lockout during disruptive network changes.
- **Configuration Auto-Sanitizer (`mtik backup --sanitize`):** Deep redaction engine masking MAC addresses, serial numbers, software IDs, passwords, shared secrets, ZeroTier IDs, and tunnel tokens.

#### Operations & Observability
- **Real-Time Bandwidth Monitor (`mtik monitor`):** Terminal live throughput monitor tracking RX/TX rates across WAN and LAN interfaces.
- **Container Controller (`mtik container`):** Inspect and restart Docker microservices running natively on RouterOS v7 hardware.
- **DNS Adlist Manager (`mtik adlist`):** Query and register tracker/adblocker feeds via `/ip dns adlist`.
- **GitOps Snapshot Backups (`mtik backup`):** Structured timestamped configuration snapshots.

#### AI & Developer Experience
- **Model Context Protocol (MCP) Server (`mtik-mcp`):** Stdio JSON-RPC interface providing 9 tools for Cursor, Antigravity, and Claude Desktop.
- **Global Terminal CLI (`mtik`):** Linked executable for zsh/bash environments.
- **Enterprise Reference Guides:** Complete runbooks for 802.1X/RADIUS, Captive Portal Walled Gardens, CAKE QoS, WireGuard Zero-Trust, and RouterOS v7 Containers.
- **Governance & Licensing:** Open-source release under GNU General Public License v3.0 (GPL-3.0).
