# DNS-over-HTTPS (DoH) & Root CA Trust Store Security

Configuring DoH in RouterOS v7 protects internal network queries from ISP eavesdropping, cache poisoning, and DNS hijacking. However, activating DoH without verifying Root CA certificates or without bootstrap static DNS entries creates a critical single-point-of-failure.

---

## 1. The Root CA Certificate Trust Requirement

In RouterOS v7, TLS connections for DoH (`use-doh-server`) strictly require valid Root CA certificates in `/certificate`. If the trust store is empty, certificate validation fails, causing the router to either silently drop DNS queries or revert to unencrypted UDP 53.

### Automated Mozilla / MikroTik Root CA Trust Store Import:
```routeros
# 1. Download official Mozilla CA bundle from MikroTik CDN
/tool fetch url="https://curl.se/ca/cacert.pem" dst-path="cacert.pem"

# 2. Import the certificate bundle into RouterOS certificate store
/certificate import file-name=cacert.pem passphrase=""

# 3. Verify that certificates are trusted
/certificate print where trusted=yes
```

---

## 2. DoH Configuration Template (Cloudflare & Quad9)

### 2.1. Bootstrap Static DNS Records
Before the router can establish an HTTPS connection to `cloudflare-dns.com` or `dns.quad9.net`, it must resolve the domain name of the DoH provider. You must add static DNS entries for the DoH servers:

```routeros
# Static IP mappings for Cloudflare DoH
/ip dns static
add name=cloudflare-dns.com address=1.1.1.1 type=A
add name=cloudflare-dns.com address=1.0.0.1 type=A
add name=cloudflare-dns.com address=2606:4700:4700::1111 type=AAAA
add name=cloudflare-dns.com address=2606:4700:4700::1001 type=AAAA

# Static IP mappings for Quad9 DoH (Malware Blocking)
add name=dns.quad9.net address=9.9.9.9 type=A
add name=dns.quad9.net address=149.112.112.112 type=A
add name=dns.quad9.net address=2620:fe::fe type=AAAA
```

### 2.2. Activate DoH with Certificate Verification
```routeros
/ip dns set \
    use-doh-server="https://cloudflare-dns.com/dns-query" \
    verify-doh-cert=yes \
    doh-max-server-connections=10 \
    doh-max-concurrent-queries=100 \
    cache-size=8192KiB \
    allow-remote-requests=yes
```

---

## 3. Transparent DNS Hijacking Prevention (Firewall NAT Redirection)

Many IoT devices, smart TVs, and malware hardcode Google DNS (`8.8.8.8`) or arbitrary public resolvers into their firmware, bypassing the router's secure DoH cache.

To force all LAN clients through the router's encrypted DoH resolver:

```routeros
# 1. Redirect standard UDP port 53 queries to the router's local resolver
/ip firewall nat
add chain=dstnat protocol=udp dst-port=53 in-interface-list=LAN \
    action=redirect to-ports=53 comment="Force LAN UDP 53 to Router DoH"

# 2. Redirect TCP port 53 queries
add chain=dstnat protocol=tcp dst-port=53 in-interface-list=LAN \
    action=redirect to-ports=53 comment="Force LAN TCP 53 to Router DoH"

# 3. Block rogue external DoH (Port 853 DoT and known public DoH IPs) if strict enforcement is required
/ip firewall filter
add chain=forward protocol=tcp dst-port=853 in-interface-list=LAN action=drop \
    comment="Drop external DNS-over-TLS (DoT)"
```

---

## 4. Verification & Health Monitoring

```routeros
# Test resolution through DoH
:put [:resolve "www.mikrotik.com"]

# Inspect DoH connection statistics
/ip dns print
# Verify 'doh-max-server-connections' is active and cache hits are increasing

# Inspect DNS cache entries
/ip dns cache print
```
