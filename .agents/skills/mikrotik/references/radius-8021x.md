# Enterprise 802.1X, EAP-PEAP / TLS & Dynamic VLAN Assignment

This runbook details configuring enterprise wireless access control on MikroTik RouterOS v7 using WPA2/WPA3-Enterprise, local CA certificate generation, and User Manager v7 dynamic VLAN assignment.

---

## 1. Local Certificate Authority & Server Certificate Generation

RouterOS v7 can act as the local PKI CA for 802.1X EAP-TLS / PEAP:

```routeros
# 1. Create Root Certificate Authority (CA)
/certificate add name=Enterprise-CA common-name="Enterprise Root CA" key-usage=key-cert-sign,crl-sign days-valid=3650
/certificate sign Enterprise-CA

# 2. Create Server Certificate for RADIUS / EAP
/certificate add name=Radius-Server common-name="radius.internal.net" key-usage=digital-signature,key-encipherment,tls-server days-valid=1825
/certificate sign Radius-Server ca=Enterprise-CA
```

---

## 2. RouterOS v7 User Manager Configuration

RouterOS v7 features a completely overhauled `/user-manager` module:

```routeros
# Enable User Manager RADIUS service
/user-manager set enabled=yes certificate=Radius-Server

# Define Router client (localhost)
/user-manager router add name=Local-Router address=127.0.0.1 shared-secret="EnterpriseSecretKey2026"

# Connect RouterOS RADIUS client to internal User Manager
/radius add service=wireless,login address=127.0.0.1 secret="EnterpriseSecretKey2026"
/radius incoming set accept=yes
```

---

## 3. Dynamic VLAN Assignment Configuration

Assign users dynamically to different VLANs (e.g., Staff = VLAN 10, IoT = VLAN 20, Guest = VLAN 30) using standard RFC 2868 and RFC 3580 attributes:

```routeros
# Create User Profiles with Dynamic VLAN attributes
/user-manager profile add name=Staff-Profile name-for-users="Staff Network"
/user-manager profile limitation add name=Staff-Limit
/user-manager profile-limitation add profile=Staff-Profile limitation=Staff-Limit

# Add Users with VLAN attributes
/user-manager user add name="ardian.ryan" password="SecurePassword123" group=staff
/user-manager user-profile add user="ardian.ryan" profile=Staff-Profile

# Attribute Injection for Dynamic VLAN
# Tunnel-Type = 13 (VLAN)
# Tunnel-Medium-Type = 6 (802)
# Tunnel-Private-Group-ID = <VLAN_ID>
/user-manager user add-attribute user="ardian.ryan" attribute=Tunnel-Type value="13"
/user-manager user add-attribute user="ardian.ryan" attribute=Tunnel-Medium-Type value="6"
/user-manager user add-attribute user="ardian.ryan" attribute=Tunnel-Private-Group-Id value="10"
```

---

## 4. Wireless Interface Enterprise Configuration

Configure the wireless interface or CAPsMAN profile for 802.1X:

```routeros
/interface wireless security-profiles add name=Enterprise-WPA3 \
    mode=dynamic-keys \
    authentication-types=wpa2-eap,wpa3-eap \
    unicast-ciphers=aes-ccm \
    group-ciphers=aes-ccm \
    radius-mac-authentication=no \
    tls-mode=verify-certificate \
    tls-certificate=Radius-Server

/interface wireless set [find default-name=wlan1] \
    security-profile=Enterprise-WPA3 \
    ssid="Corporate-Secure" \
    disabled=no
```
