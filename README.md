```text
  MMM      MMM       KKK                          TTTTTTTTTTT      KKK
  MMMM    MMMM       KKK                          TTTTTTTTTTT      KKK
  MMM MMMM MMM  III  KKK  KKK  RRRRRR     OOOOOO      TTT     III  KKK  KKK
  MMM  MM  MMM  III  KKKKK     RRR  RRR  OOO  OOO     TTT     III  KKKKK
  MMM      MMM  III  KKK KKK   RRRRRR    OOO  OOO     TTT     III  KKK KKK
  MMM      MMM  III  KKK  KKK  RRR  RRR   OOOOOO      TTT     III  KKK  KKK

  MikroTik RouterOS v7 Skill & Automation Toolkit (CLI & MCP Server)
```

# MikroTik RouterOS v7 Skill & CLI Toolkit

[![CI](https://github.com/ardianryan/mikrotik-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/ardianryan/mikrotik-skill/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Target](https://img.shields.io/badge/RouterOS-v7.x_Only-red.svg)](https://mikrotik.com/)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

> **Personal Daily Productivity & Network Automation Toolkit**  
> Authored by **Ardian Ryan** (<me@ardianryan.com>) to streamline network operations, multi-WAN load balancing, automated security auditing, and safe rule deployment on MikroTik RouterOS v7 devices.

---

## CRITICAL NOTICE & DISCLAIMER

> [!CAUTION]
> ### STRICT ROUTEROS v7 REQUIREMENT
> This toolkit is **ENGINEERED EXCLUSIVELY FOR MIKROTIK ROUTEROS v7** (v7.1+).  
> **DO NOT USE THIS TOOL ON ROUTEROS v6.** RouterOS v6 utilizes completely incompatible syntax for routing tables, FIB allocation, and firewall mangle rules, and lacks the native REST API subsystem.

> [!WARNING]
> ### NOT RECOMMENDED FOR DIRECT PRODUCTION DEPLOYMENT
> This software is intended as an automation assistant for personal and homelab environments.  
> **IT IS STRONGLY ADVISED NOT TO RUN BLIND MUTATIONS DIRECTLY ON MISSION-CRITICAL ENTERPRISE PRODUCTION NETWORKS WITHOUT RIGOROUS STAGING.**
>
> 1. **Always use Sandbox / Lab Mode first:** Test all rules and configurations on a local virtual machine (MikroTik Cloud Hosted Router / CHR) or testing workbench.
> 2. **Always use `--dry-run`:** Preview the colored visual diff of every proposed rule before applying it to physical hardware.
> 3. **Verify Watchdog Rollback:** Ensure safe-mode watchdog timers are active before mutating default routing or input firewall chains.

> [!IMPORTANT]
> ### DO AT YOUR OWN RISK (WARRANTY DISCLAIMER)
> THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND. NETWORK AUTOMATION CAN CAUSE IMMEDIATE DEVICE LOCKOUT, PACKET ROUTING LOOPS, OR SERVICE INTERRUPTIONS IF MISCONFIGURED. YOU ASSUME FULL AND SOLE RESPONSIBILITY FOR ANY NETWORK OUTAGE, DATA LOSS, OR HARDWARE MISBEHAVIOR RESULTING FROM THE USE OF THIS TOOL.

---

## Overview

Managing MikroTik routers in multi-WAN environments often involves repetitive `.rsc` exports, delicate Mangle ordering, and the constant risk of lockout. 

**MikroTik Skill & CLI Toolkit** is a modular, type-safe automation suite designed to solve this. It provides both a powerful terminal CLI (`mtik`) and a Model Context Protocol (MCP) server (`mtik-mcp`) allowing AI coding assistants (such as Antigravity, Cursor, and Claude Desktop) to audit, inspect, and safely configure RouterOS v7 infrastructure with zero hallucinations.

---

## Key Features

- **Dual-Engine Connection:**
  - **Primary:** High-speed RouterOS v7 native REST API (`/rest`, HTTPS/HTTP) with structured JSON responses and self-signed certificate tolerance.
  - **Automatic Fallback:** Seamless fallback to RouterOS native binary API socket (Port 8728 / 8729 SSL) if WebFig or REST is disabled.
- **Automated 7-Pillar Security Audit:**
  - One-command audit evaluating DNS open resolvers, exposed administrative services, missing firewall input drops, NTP clock drift, and Mangle Hairpin NAT leak risks.
- **Deterministic Mangle Order Engine:**
  - Prevents packet misrouting by enforcing the strict RouterOS hierarchy: **Bypass Rules** (`connection-nat-state=dstnat`, `LOCAL_BYPASS`) at index 0 $\rightarrow$ **Dedicated Client Overrides** $\rightarrow$ **PCC Load Balancing**.
- **FIB Integrity Validation:**
  - Verifies custom routing tables are declared in `/routing table` with `fib=yes` before any Mangle rule is injected.
- **30-Second Safe-Mode Watchdog:**
  - Automatically arms a temporary `/system schedule` rollback timer before critical changes. If connection is interrupted or unverified within 30 seconds, the router reverts the change automatically.
- **Auto-Sanitizer Export (`mtik backup --sanitize`):**
  - Exports structured JSON snapshots with automatic redaction of MAC addresses (`XX:XX:XX...`), serial numbers, passwords, shared secrets, and VPN network IDs—making exports 100% safe to share with AI or public forums.
- **Real-Time Terminal Bandwidth Monitor (`mtik monitor`):**
  - Live throughput meter in the terminal tracking RX/TX (Mbps/Kbps) across WAN and LAN interfaces.
- **Container & DNS Adlist Management:**
  - Inspect and restart local Docker microservices (`mtik container`) and manage network-wide adblocker feeds (`mtik adlist`).
- **Enterprise Reference Runbooks:**
  - Modular guides covering 802.1X/RADIUS (EAP-PEAP/TLS), Dynamic VLAN assignment, Modern CAKE/FQ-CoDel QoS, Captive Portal Walled Gardens, WireGuard Zero-Trust, and RouterOS v7 Docker containers.

---

## Architecture

```text
                  ┌──────────────────────────────┐
                  │    CLI (`mtik`) / AI Agent   │
                  └──────────────┬───────────────┘
                                 │
                     [Connection Manager Layer]
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼ (Primary Transport)                       ▼ (Automatic Fallback)
   ┌──────────────────────┐                    ┌─────────────────────────┐
   │ RouterOS v7 REST API │                    │ RouterOS Binary API     │
   │ (Port 443 / 80)      │                    │ (Port 8728 / 8729 SSL)  │
   └──────────┬───────────┘                    └────────────┬────────────┘
              │                                             │
              └──────────────────────┬──────────────────────┘
                                     │
                                     ▼
                          ┌───────────────────────┐
                          │ MikroTik RouterOS v7  │
                          │   (Multi-WAN Router)  │
                          └───────────────────────┘
```

---

## Installation & Setup

### 1. Requirements
- Node.js >= 20.0.0
- MikroTik Router running RouterOS v7.1 or higher

### 2. Quickstart
```bash
# Clone the repository
git clone https://github.com/ardianryan/mikrotik-skill.git
cd mikrotik-skill

# Install dependencies
npm install

# Build TypeScript
npm run build

# Link CLI globally to your terminal
npm link
```

### 3. Configure Credentials
Create a `.env` file in your working directory or project root:
```env
ROUTEROS_HOST=192.168.88.1
ROUTEROS_USER=admin
ROUTEROS_PASSWORD=your_secure_password

# Optional Port Overrides
ROUTEROS_REST_PORT=443
ROUTEROS_USE_SSL=true
ROUTEROS_API_PORT=8728
ROUTEROS_API_SSL_PORT=8729

# Optional API Key for Remote / Vercel / ChatGPT Action Gateway
MTIK_API_KEY=your_secret_api_token
```

---

## 🚀 Panduan Penggunaan Mudah (Easy to Use)

Pilih metode integrasi yang paling sesuai dengan alur kerja Anda:

| Mode | Target Platform | Perlu Deploy? | Cara Pakai |
| :--- | :--- | :---: | :--- |
| **Mode 1: Local IDE** | **Cursor, Claude Desktop, Antigravity, Windsurf** | ❌ **0 Deploy** | Berjalan 100% lokal via `stdio`. Sambungkan langsung ke router di `192.168.88.1`. |
| **Mode 2: Web AI (Prompt)** | **ChatGPT Web, Claude.ai Web** | ❌ **0 Deploy** | Ekspor prompt via `mtik prompt`, paste ke Custom GPT/Claude Project. AI menghasilkan skrip siap copas. |
| **Mode 3: Web AI (Direct Actions)** | **ChatGPT Custom GPT Actions** | ☁️ **Vercel Deploy** | Deploy ke Vercel untuk menghubungkan cloud ChatGPT langsung ke router secara otomatis via OpenAPI. |

### 🌟 Mode 1: Local IDE (Paling Praktis & Bebas Deploy)
1. Build project:
   ```bash
   npm run build
   ```
2. Tambahkan konfigurasi ke `mcp_config.json` atau `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "mikrotik": {
         "command": "node",
         "args": ["/Users/ardianryan/Documents/MikroTIK-Skill/dist/mcp/index.js"],
         "env": {
           "ROUTEROS_HOST": "192.168.88.1",
           "ROUTEROS_USER": "admin",
           "ROUTEROS_PASSWORD": "your_secure_password"
         }
       }
     }
   }
   ```
3. AI di IDE Anda langsung bisa membaca status router, menjalankan audit, dan mengeksekusi perintah.

---

### 💬 Mode 2: Web AI via Copy-Paste (ChatGPT & Claude Web)
1. Ekspor instruksi certified engineer:
   ```bash
   mtik prompt -o mikrotik-system-prompt.md
   ```
2. Masukkan isi file tersebut ke kolom **Instructions** di ChatGPT Custom GPT atau Claude Project.
3. ChatGPT/Claude di web browser akan selalu menghasilkan skrip `routeros` murni berstandar v7 yang dapat langsung di-copas ke WinBox Terminal atau dijalankan lewat:
   ```bash
   mtik exec "<perintah-dari-chatgpt>"
   ```

---

### ☁️ Mode 3: Web AI via Vercel Deployment & ChatGPT Actions
Gunakan mode ini jika Anda ingin tombol **Actions** di ChatGPT Web bisa langsung mengeksekusi router secara otomatis.

> **Kenapa Vercel, bukan GitHub Pages?**  
> **GitHub Pages** hanya melayani file statis (HTML/CSS) di browser tanpa server backend Node.js dan tidak bisa membuka socket/koneksi ke router Anda.  
> **Vercel** menyediakan Serverless Function (Node.js) di cloud dengan URL HTTPS publik untuk OpenAPI / ChatGPT Actions.

#### Langkah Cepat Deploy Vercel (1 Menit):
1. **Deploy ke Vercel:**
   ```bash
   # Login dan deploy langsung dari terminal
   npx vercel
   ```
2. **Atur Environment Variables di Vercel Dashboard:**
   - `ROUTEROS_HOST`: Host / DDNS router Anda (contoh: `xxx.sn.mynetname.net` atau IP publik/VPN).
   - `ROUTEROS_USER`: User admin / API MikroTik.
   - `ROUTEROS_PASSWORD`: Password router.
   - `ROUTEROS_REST_PORT`: `443`.
   - `ROUTEROS_USE_SSL`: `true`.
   - `MTIK_API_KEY`: Token rahasia pengaman (misal `my-secret-key-12345`).
3. **Impor ke ChatGPT Custom GPT Actions:**
   - Di Custom GPT Editor $\rightarrow$ **Actions** $\rightarrow$ **Create new action**.
   - Pilih **Import from URL** dan masukkan:  
     `https://<nama-project-anda>.vercel.app/openapi.json`
   - Pada opsi **Authentication**, pilih **API Key**, Auth Type: **Bearer**, lalu masukkan token `MTIK_API_KEY` Anda.
   - Selesai! ChatGPT di web sekarang bisa membaca status, menjalankan audit, dan memicu perintah MikroTik secara langsung.

*(Catatan Jaringan Privat / Homelab: Jika router Anda berada di balik NAT/CGNAT tanpa IP publik, jalankan `mtik serve --port 3000` di laptop/server lokal dan gunakan Cloudflare Tunnel gratis `cloudflared tunnel`)*.

---

## CLI Usage (`mtik`)

```bash
# Verify connectivity and active transport (REST vs Binary API)
mtik test

# Display system health, CPU utilization, and lease counters
mtik status

# Run automated 7-Pillar Security Audit
mtik audit

# List firewall mangle rules with index & hierarchy breakdown
mtik mangle

# Preview proposed route changes without applying (Dry-Run / Sandbox)
mtik route-force --ip 192.168.88.50 --table to_ISP1 --dry-run

# Safely force an internal IP to exit via a specific ISP table
mtik route-force --ip 192.168.88.50 --table to_ISP1 --comment "Dev Server Priority"

# Export sanitized configuration (all MACs, serials, passwords redacted)
mtik backup --sanitize

# Launch live interface throughput monitor
mtik monitor

# Manage Docker microservices on RouterOS v7 hardware
mtik container
mtik container --restart 0

# Inspect DNS adblocker feed lists
mtik adlist

# Manage multi-router profiles securely
mtik profile --save homelab
mtik profile

# Generate certified templates across all 10 MikroTik Certification tracks
mtik template --list
mtik template mtcswe --output mtcswe-switching.rsc

# Execute arbitrary RouterOS CLI scripts atomically
mtik exec "/ip/address/print"

# Query RouterOS v7 REST endpoints directly
mtik rest GET /system/resource

# Export optimized system prompt for ChatGPT Custom GPT or Claude.ai Project
mtik prompt
mtik prompt -o mikrotik-system-prompt.md
```

---

## AI Agent Integration (Model Context Protocol - MCP)

This repository includes a stdio MCP server (`mtik-mcp`) allowing AI coding assistants to invoke RouterOS tools safely.

### Cursor / Claude Desktop / Antigravity Config
Add this entry to your `mcp_config.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mikrotik": {
      "command": "node",
      "args": ["/Users/ardianryan/Documents/MikroTIK-Skill/dist/mcp/index.js"],
      "env": {
        "ROUTEROS_HOST": "192.168.88.1",
        "ROUTEROS_USER": "admin",
        "ROUTEROS_PASSWORD": "your_secure_password",
        "ROUTEROS_REST_PORT": "443",
        "ROUTEROS_USE_SSL": "true"
      }
    }
  }
}
```

### Available Tools:
- `mikrotik_test_connection`: Test connectivity & transport detection.
- `mikrotik_get_system_status`: Inspect CPU, memory, uptime, and interfaces.
- `mikrotik_audit_security`: Execute 10-Pillar Security Audit.
- `mikrotik_list_mangle`: View mangle rules with hierarchy analysis.
- `mikrotik_force_routing`: Assign client IP to routing table with dry-run and watchdog protection.
- `mikrotik_manage_dhcp_lease`: List and add static DHCP leases.
- `mikrotik_export_sanitized_config`: Export anonymized configuration for safe AI analysis.
- `mikrotik_manage_container`: List and restart Docker containers.
- `mikrotik_get_adlist_status`: Query active DNS adblocker feeds.
- `mikrotik_generate_template`: Generate certified configurations for all 10 MikroTik tracks (MTCNA, MTCRE, MTCINE, MTCSWE, MTCTCE, MTCSE, MTCIPv6E, MTCUME, MTCEWE, MTCWE).
- `mikrotik_execute_command`: Atomically execute arbitrary RouterOS CLI commands or scripts.
- `mikrotik_rest_query`: Query RouterOS v7 `/rest/<endpoint>` with GET, POST, PUT, PATCH, DELETE.
- `mikrotik_get_chat_prompt`: Retrieve senior engineer prompt for ChatGPT and Claude.ai.

---

## Enterprise Documentation & Runbooks

Deep-dive technical runbooks are available in [`.agents/skills/mikrotik/references/`](./.agents/skills/mikrotik/references/):

| Runbook | Description |
| :--- | :--- |
| [Enterprise 802.1X / RADIUS](./.agents/skills/mikrotik/references/radius-8021x.md) | WPA2/WPA3-Enterprise, local CA generation, and Dynamic VLAN assignment. |
| [Captive Portal & Walled Garden](./.agents/skills/mikrotik/references/hotspot-portal.md) | Mobile-first HTML5 login portal and OAuth/Payment Gateway whitelisting. |
| [Modern CAKE QoS](./.agents/skills/mikrotik/references/qos-cake.md) | Anti-bufferbloat queuing and DSCP voice/interactive prioritization. |
| [WireGuard Zero-Trust VPN](./.agents/skills/mikrotik/references/wireguard-vpn.md) | High-speed remote access tunnels and peer key management. |
| [Docker Containers on RouterOS v7](./.agents/skills/mikrotik/references/docker-containers.md) | Deploying AdGuard Home, Cloudflare Tunnel, and Tailscale on router hardware. |

---

## Development & Testing

```bash
# Run strict TypeScript typechecking
npm run typecheck

# Run automated unit tests
npm test

# Build production artifacts
npm run build
```

---

## Security & Vulnerability Reporting

Please report security issues directly to **Ardian Ryan** at **[me@ardianryan.com](mailto:me@ardianryan.com)**.  
See [SECURITY.md](./SECURITY.md) for vulnerability disclosure procedures.

---

## License

Released under the **[GNU General Public License v3.0 (GPL-3.0)](./LICENSE)**.  
Copyright (c) 2026 Ardian Ryan <me@ardianryan.com>.
