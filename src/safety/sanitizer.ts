export class ConfigSanitizer {
  private static readonly MAC_REGEX = /\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b/g;
  private static readonly SERIAL_REGEX = /(["']?(?:serial(?:-|\s*)number|serial)["']?\s*[:=]\s*"?)([A-Za-z0-9]+)("?)/gi;
  private static readonly SOFTWARE_ID_REGEX = /(["']?(?:software(?:-|\s*)id)["']?\s*[:=]\s*"?)([A-Za-z0-9-]+)("?)/gi;
  private static readonly PASSWORD_REGEX = /(["']?(?:password|secret|shared-secret)["']?\s*[:=]\s*"?)([^"\s;]+)("?)/gi;
  private static readonly ZEROTIER_ID_REGEX = /(["']?network["']?\s*[:=]\s*"?)([0-9a-fA-F]{16})("?)/gi;
  private static readonly CERTIFICATE_REGEX = /(["']?certificate["']?\s*[:=]\s*"?)([^"\s;]+)("?)/gi;
  private static readonly TUNNEL_TOKEN_REGEX = /(["']?TUNNEL_TOKEN["']?\s*[:=]\s*"?)([^"\s;]+)("?)/gi;

  static sanitizeText(rawConfig: string): string {
    let sanitized = rawConfig;

    // 1. Redact MAC addresses
    sanitized = sanitized.replace(this.MAC_REGEX, 'XX:XX:XX:XX:XX:XX');

    // 2. Redact serial numbers and software IDs
    sanitized = sanitized.replace(this.SERIAL_REGEX, '$1[REDACTED_SERIAL]$3');
    sanitized = sanitized.replace(this.SOFTWARE_ID_REGEX, '$1[REDACTED_ID]$3');

    // 3. Redact passwords, secrets, pre-shared keys
    sanitized = sanitized.replace(this.PASSWORD_REGEX, '$1********$3');

    // 4. Redact ZeroTier network IDs
    sanitized = sanitized.replace(this.ZEROTIER_ID_REGEX, '$1[REDACTED_ZT_NETWORK]$3');

    // 5. Redact certificate and token values
    sanitized = sanitized.replace(this.CERTIFICATE_REGEX, '$1server_cert$3');
    sanitized = sanitized.replace(this.TUNNEL_TOKEN_REGEX, '$1********$3');

    return sanitized;
  }

  static sanitizeObject<T extends Record<string, unknown>>(data: T): T {
    const jsonStr = JSON.stringify(data);
    const sanitizedStr = this.sanitizeText(jsonStr);
    return JSON.parse(sanitizedStr) as T;
  }

  static sanitizeJson<T>(data: T): T {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') return this.sanitizeText(data) as unknown as T;
    const jsonStr = JSON.stringify(data);
    const sanitizedStr = this.sanitizeText(jsonStr);
    return JSON.parse(sanitizedStr) as T;
  }
}
