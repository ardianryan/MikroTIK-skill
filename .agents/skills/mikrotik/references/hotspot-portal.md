# Modern Captive Portal & Walled Garden Configuration

This reference covers building, styling, and deploying custom responsive captive portals and walled garden configurations on MikroTik RouterOS v7.

---

## 1. Hotspot Directory & File Structure

RouterOS serves captive portal files from the `html-directory` specified in `/ip hotspot profile`:

```text
flash/hotspot/ (or hotspot/)
├── login.html        # Main landing and authentication form
├── alogin.html       # Post-login redirect and notification page
├── status.html       # Active session status, uptime, byte counter
├── logout.html       # Explicit session termination page
├── errors.txt        # Localized error code mappings
├── style.css         # Modern responsive CSS
└── logo.svg          # Lightweight vector brand asset
```

---

## 2. Minimalist Responsive `login.html` (Mobile-First)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Network Authentication</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 2rem; width: 100%; max-width: 380px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; text-align: center; }
    p { font-size: 0.875rem; color: #94a3b8; margin-bottom: 1.5rem; text-align: center; }
    .input-group { margin-bottom: 1rem; }
    label { display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #cbd5e1; margin-bottom: 0.25rem; }
    input[type="text"], input[type="password"] { width: 100%; padding: 0.75rem; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 0.95rem; }
    input:focus { outline: none; border-color: #38bdf8; ring: 2px solid #38bdf8; }
    button { width: 100%; padding: 0.75rem; border-radius: 6px; border: none; background: #2563eb; color: #fff; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #1d4ed8; }
    .footer { margin-top: 1.5rem; font-size: 0.75rem; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Welcome to Network</h1>
    <p>Please authenticate to access the Internet</p>
    <form name="login" action="$(link-login-only)" method="post">
      <input type="hidden" name="dst" value="$(link-orig)" />
      <input type="hidden" name="popup" value="true" />
      <div class="input-group">
        <label for="username">Username</label>
        <input id="username" name="username" type="text" value="$(username)" required autocomplete="username" />
      </div>
      <div class="input-group">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required autocomplete="current-password" />
      </div>
      <button type="submit">Sign In</button>
    </form>
    <div class="footer">Protected by MikroTik RouterOS v7</div>
  </div>
</body>
</html>
```

---

## 3. Walled Garden Rules for OAuth & Payment Gateways

Allow unauthenticated clients to communicate with payment or authentication APIs prior to login:

```routeros
# Allow Payment Gateway APIs (e.g. Midtrans, Xendit, Stripe)
/ip hotspot walled-garden add dst-host=*.midtrans.com action=allow comment="Payment Gateway"
/ip hotspot walled-garden add dst-host=*.xendit.co action=allow comment="Payment Gateway"

# Allow OAuth Providers (Google, Apple, Microsoft)
/ip hotspot walled-garden add dst-host=accounts.google.com action=allow comment="OAuth Google"
/ip hotspot walled-garden add dst-host=*.googleapis.com action=allow comment="OAuth Google API"
/ip hotspot walled-garden add dst-host=appleid.apple.com action=allow comment="OAuth Apple"

# Allow Corporate CDN & Static Assets
/ip hotspot walled-garden add dst-host=cdn.internal.net action=allow comment="Corporate Static CDN"
```

---

## 4. Deploying Assets to Flash Storage

Upload customized files to the router:
```bash
# Upload via SFTP to flash storage
scp -P 22 login.html admin@192.168.88.1:/flash/hotspot/login.html
scp -P 22 style.css admin@192.168.88.1:/flash/hotspot/style.css
```
