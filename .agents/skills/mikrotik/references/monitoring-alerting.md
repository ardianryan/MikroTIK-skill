# Real-Time Incident Alerting & Observability (Netwatch v7, Webhooks, IPFIX)

Enterprise network operations require instant automated alerting when primary links fail, CPU utilization spikes, or security breaches occur. This guide documents automated Telegram / Webhook integration and telemetry export in RouterOS v7.

---

## 1. Automated Telegram Alerting Script Function

RouterOS v7 can send HTTP POST payloads via `/tool fetch`. Define a reusable function in `/system script`:

```routeros
# Create Telegram Notification Script
/system script
add name=send-telegram-alert source="
:local botToken \"BOT_TOKEN_REDACTED\";
:local chatId \"CHAT_ID_REDACTED\";
:local message \$alertMessage;

:if ([:len \$message] > 0) do={
    /tool fetch url=\"https://api.telegram.org/bot\$botToken/sendMessage\" \
        http-method=post \
        http-header-field=\"Content-Type: application/json\" \
        http-data=\"{\\\"chat_id\\\": \\\"\$chatId\\\", \\\"text\\\": \\\"\$message\\\", \\\"parse_mode\\\": \\\"HTML\\\"}\" \
        keep-result=no;
}
"
```

---

## 2. Multi-WAN Failover Alerting via Netwatch v7

Netwatch v7 supports advanced ICMP probing, packet counts, and jitter measurement to detect ISP link failure immediately:

```routeros
# Monitor ISP1 Upstream Reachability via Cloudflare DNS (1.1.1.1)
/tool netwatch
add host=1.1.1.1 type=icmp interval=5s timeout=1000ms \
    up-script="
        :global alertMessage \"🟢 <b>[NETWORK RECOVERED]</b> Primary ISP link is ONLINE.\";
        /system script run send-telegram-alert;
        /log info \"Primary ISP restored\";
    " \
    down-script="
        :global alertMessage \"🔴 <b>[FAILOVER TRIGGERED]</b> Primary ISP link is DOWN! Traffic routed to Backup ISP.\";
        /system script run send-telegram-alert;
        /log warning \"Primary ISP failed, failover active\";
    " \
    comment="ISP1-SLA-Watch"
```

---

## 3. High CPU & Brute-Force Automated Alerting

### 3.1. CPU Overload Watchdog
Runs every 60 seconds. If CPU load exceeds 85%, triggers an alert with top process details:

```routeros
/system scheduler
add name=cpu-health-check interval=1m on-event="
    :local cpuLoad [/system resource get cpu-load];
    :if (\$cpuLoad > 85) do={
        :global alertMessage \"⚠️ <b>[HIGH CPU LOAD]</b> Router CPU is at \$cpuLoad%!\";
        /system script run send-telegram-alert;
        /log error \"High CPU Alert: \$cpuLoad%\";
    }
"
```

### 3.2. Brute-Force Port Scan Detection
Firewall filter rules that automatically flag attackers in an address list and log them:

```routeros
/ip firewall filter
add chain=input protocol=tcp psd=21,3s,3,1 action=add-src-to-address-list \
    address-list=port-scanners address-list-timeout=1d \
    comment="Detect and ban port scanners for 24h"
add chain=input src-address-list=port-scanners action=drop \
    comment="Drop port scanners"
```

---

## 4. Telemetry Export: SNMP v3 & Traffic Flow (IPFIX / NetFlow)

### 4.1. Secure SNMP v3 Configuration
```routeros
# Configure SNMP v3 with SHA authentication and AES encryption
/snmp community
set [find default=yes] disabled=yes
add name=monitoring-v3 security=private \
    authentication-protocol=SHA \
    authentication-password="StrongAuthPassword123" \
    encryption-protocol=AES \
    encryption-password="StrongPrivPassword123" \
    addresses=192.168.88.50/32

/snmp set enabled=yes contact="noc@enterprise.local" location="Datacenter-Rack-A"
```

### 4.2. Traffic Flow (IPFIX) Export to Grafana / ELK
Enables flow monitoring (source IP, destination IP, bandwidth per application) exported to an external collector (e.g. ntopng, Grafana Flow, or Elastiflow):

```routeros
/ip traffic-flow
set enabled=yes cache-entries=128k active-flow-timeout=1m inactive-flow-timeout=15s

/ip traffic-flow target
add dst-address=192.168.88.50 port=2055 version=ipfix
```
