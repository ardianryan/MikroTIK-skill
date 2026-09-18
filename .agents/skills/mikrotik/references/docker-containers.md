# Running Docker Containers on MikroTik RouterOS v7

This runbook covers configuring the native `/container` subsystem in RouterOS v7 to deploy lightweight services (such as *AdGuard Home*, *Cloudflare Tunnel `cloudflared`*, or *Pi-hole*) directly on ARM, ARM64, and x86 MikroTik hardware.

---

## 1. Storage & Container Subsystem Prerequisites

Containers should always run on an external USB drive or SSD partition (`usb1/`) to avoid wearing out internal flash NAND memory:

```routeros
# 1. Enable Device Mode for Containers (Requires physical button press or reboot confirmation)
/system/device-mode/update container=yes

# 2. Configure Docker Registry URL and RAM limits
/container/config/set registry-url=https://registry-1.docker.io tmpdir=usb1/tmp
```

---

## 2. Virtual Ethernet (VETH) & Bridge Configuration

Create an isolated network segment for containers:

```routeros
# 1. Create Virtual Ethernet Interface for Container
/interface/veth/add name=veth-adguard address=172.17.0.2/24 gateway=172.17.0.1

# 2. Create Container Bridge
/interface/bridge/add name=bridge-containers
/interface/bridge/port add bridge=bridge-containers interface=veth-adguard

# 3. Assign IP Gateway to Container Bridge
/ip/address/add address=172.17.0.1/24 interface=bridge-containers

# 4. Outbound NAT Masquerade for Containers
/ip/firewall/nat/add chain=srcnat src-address=172.17.0.0/24 action=masquerade comment="Container Internet Access"
```

---

## 3. Example 1: Deploying AdGuard Home

```routeros
# 1. Setup Volume Mounts on USB Storage
/container/mounts/add name=adguard_work src=usb1/adguard/work dst=/opt/adguardhome/work
/container/mounts/add name=adguard_conf src=usb1/adguard/conf dst=/opt/adguardhome/conf

# 2. Pull and Run Container Image
/container/add remote-image="adguard/adguardhome:latest" \
    interface=veth-adguard \
    root-dir=usb1/adguard/root \
    mounts=adguard_work,adguard_conf \
    logging=yes \
    comment="AdGuard Home DNS Sinkhole"

# 3. Start the Container
/container/start [find comment="AdGuard Home DNS Sinkhole"]
```

---

## 4. Example 2: Deploying Cloudflare Tunnel (`cloudflared`)

Expose local router services securely to the internet without port forwarding or public static IPs:

```routeros
# 1. Setup Environment Variable with Tunnel Token
/container/envs/add name=cf_env key=TUNNEL_TOKEN value="YOUR_CLOUDFLARE_TUNNEL_TOKEN_HERE"

# 2. Create VETH for Cloudflare Tunnel
/interface/veth/add name=veth-cloudflared address=172.17.0.3/24 gateway=172.17.0.1
/interface/bridge/port add bridge=bridge-containers interface=veth-cloudflared

# 3. Pull and Start Container
/container/add remote-image="cloudflare/cloudflared:latest" \
    interface=veth-cloudflared \
    root-dir=usb1/cloudflared/root \
    envlist=cf_env \
    cmd="tunnel --no-autoupdate run" \
    logging=yes \
    comment="Cloudflare Zero Trust Tunnel"

/container/start [find comment="Cloudflare Zero Trust Tunnel"]
```
