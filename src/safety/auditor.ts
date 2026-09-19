import type { ConnectionManager } from '../client/connection-manager.js';
import type { AuditItem, AuditReport, SystemResource, DnsSettings, NtpClient } from '../client/types.js';

export class SecurityAuditor {
  private conn: ConnectionManager;

  constructor(conn: ConnectionManager) {
    this.conn = conn;
  }

  async runFullAudit(): Promise<AuditReport> {
    const items: AuditItem[] = [];

    const [resource, dns, services, filters, mangle, tables, ntp] = await Promise.all([
      this.conn.getResource().catch(() => ({} as SystemResource)),
      this.conn.getDnsSettings().catch(() => ({} as DnsSettings)),
      this.conn.getIpServices().catch(() => []),
      this.conn.getFirewallFilters().catch(() => []),
      this.conn.getMangleRules().catch(() => []),
      this.conn.getRoutingTables().catch(() => []),
      this.conn.getNtpClient().catch(() => ({} as NtpClient)),
    ]);

    if (!resource || (!resource.version && !resource.platform && !resource.board)) {
      throw new Error('Router unreachable or returned empty system resources. Verify device connectivity, port, and credentials.');
    }

    // Pillar 1: DNS Open Resolver Check
    const allowRemote = dns['allow-remote-requests'] === true || dns['allow-remote-requests'] === 'true' || dns['allow-remote-requests'] === 'yes';
    if (allowRemote) {
      const dropsWanDns = filters.some(
        (f) =>
          f.chain === 'input' &&
          f.action === 'drop' &&
          (f.protocol === 'udp' || !f.protocol) &&
          (f['dst-port'] === '53' || f['dst-port']?.includes('53'))
      );

      if (dropsWanDns) {
        items.push({
          pillar: 'Pillar 1: DNS Protection',
          title: 'DNS Open Resolver',
          status: 'PASS',
          detail: 'Remote DNS queries are allowed, but WAN UDP/53 is explicitly blocked in firewall filters.',
        });
      } else {
        items.push({
          pillar: 'Pillar 1: DNS Protection',
          title: 'DNS Open Resolver',
          status: 'CRITICAL',
          detail: 'Router allows remote DNS requests with NO firewall filter blocking WAN UDP/53! Vulnerable to DNS amplification attacks.',
          recommendation: 'Add firewall filter to drop input on UDP port 53 from WAN interfaces.',
          remediationCommand: '/ip firewall filter add chain=input in-interface-list=WAN protocol=udp dst-port=53 action=drop comment="Drop WAN DNS"',
        });
      }
    } else {
      items.push({
        pillar: 'Pillar 1: DNS Protection',
        title: 'DNS Open Resolver',
        status: 'PASS',
        detail: 'Remote DNS queries are disabled (/ip dns allow-remote-requests=no).',
      });
    }

    // Pillar 2: Sensitive Services Exposure
    const sensitiveServices = ['winbox', 'api', 'api-ssl', 'ssh', 'www', 'www-ssl'];
    for (const sName of sensitiveServices) {
      const srv = services.find((s) => s.name === sName);
      if (srv && srv.disabled !== true && srv.disabled !== 'true') {
        const hasAddressRestriction = Boolean(srv.address && srv.address.trim() !== '' && srv.address !== '0.0.0.0/0');
        if (hasAddressRestriction) {
          items.push({
            pillar: 'Pillar 2: Service Hardening',
            title: `Service [${sName}] Access`,
            status: 'PASS',
            detail: `Service '${sName}' (port ${srv.port}) is restricted to IP subnet: ${srv.address}`,
          });
        } else {
          items.push({
            pillar: 'Pillar 2: Service Hardening',
            title: `Service [${sName}] Exposure`,
            status: 'WARN',
            detail: `Service '${sName}' (port ${srv.port}) is active with NO address restriction. Anyone who reaches this port can attempt authentication.`,
            recommendation: `Restrict '${sName}' to trusted management subnets using 'address=' parameter.`,
            remediationCommand: `/ip service set ${sName} address=192.168.88.0/24`,
          });
        }
      }
    }

    // Pillar 3: Hairpin NAT & Mangle Prerouting
    const dstnatMangleIndex = mangle.findIndex((m) => m['connection-nat-state'] === 'dstnat' && m.action === 'accept');
    if (dstnatMangleIndex === 0) {
      items.push({
        pillar: 'Pillar 3: Mangle Hierarchy',
        title: 'Hairpin NAT Mangle Bypass',
        status: 'PASS',
        detail: 'Mangle rule for DST-NAT bypass is correctly placed at index 0 in prerouting chain.',
      });
    } else if (dstnatMangleIndex > 0) {
      items.push({
        pillar: 'Pillar 3: Mangle Hierarchy',
        title: 'Hairpin NAT Mangle Position',
        status: 'WARN',
        detail: `DST-NAT bypass mangle rule is at index ${dstnatMangleIndex} instead of 0. Forwarded port traffic might be misrouted by earlier rules.`,
        recommendation: 'Move DST-NAT accept mangle rule to index 0.',
        remediationCommand: `/ip firewall mangle move ${dstnatMangleIndex} destination=0`,
      });
    } else {
      items.push({
        pillar: 'Pillar 3: Mangle Hierarchy',
        title: 'Hairpin NAT Mangle Bypass',
        status: 'INFO',
        detail: 'No DST-NAT bypass rule found in Mangle prerouting. If port forwarding with Hairpin NAT is used, add bypass rule.',
        recommendation: 'Add connection-nat-state=dstnat action=accept rule at top of prerouting.',
        remediationCommand: '/ip firewall mangle add chain=prerouting connection-nat-state=dstnat action=accept place-before=0 comment="Hairpin NAT Bypass"',
      });
    }

    // Pillar 4: Routing Table FIB Integrity
    const routingMarksUsed = new Set<string>();
    for (const m of mangle) {
      if (m['new-routing-mark']) {
        routingMarksUsed.add(m['new-routing-mark']);
      }
    }

    for (const mark of routingMarksUsed) {
      const table = tables.find((t) => t.name === mark);
      if (!table) {
        items.push({
          pillar: 'Pillar 4: Routing FIB Integrity',
          title: `Routing Mark '${mark}' Registration`,
          status: 'CRITICAL',
          detail: `Routing mark '${mark}' is used in Mangle, but is NOT defined in '/routing table'! Packets will use the main table instead.`,
          recommendation: `Register table '${mark}' with fib=yes in RouterOS v7.`,
          remediationCommand: `/routing table add name="${mark}" fib`,
        });
      } else {
        const isFib = table.fib === true || table.fib === 'true' || table.fib === 'yes';
        if (!isFib) {
          items.push({
            pillar: 'Pillar 4: Routing FIB Integrity',
            title: `Routing Table '${mark}' FIB Status`,
            status: 'CRITICAL',
            detail: `Table '${mark}' exists, but has 'fib=no'. RouterOS v7 cannot forward packets through this table.`,
            recommendation: `Enable FIB on table '${mark}'.`,
            remediationCommand: `/routing table set [find name="${mark}"] fib`,
          });
        } else {
          items.push({
            pillar: 'Pillar 4: Routing FIB Integrity',
            title: `Routing Table '${mark}' FIB`,
            status: 'PASS',
            detail: `Table '${mark}' is properly registered with FIB enabled in RouterOS v7.`,
          });
        }
      }
    }

    // Pillar 5: NTP Synchronization
    const ntpEnabled = ntp.enabled === true || ntp.enabled === 'true' || ntp.enabled === 'yes';
    if (ntpEnabled) {
      items.push({
        pillar: 'Pillar 5: Time Synchronization',
        title: 'NTP Client Status',
        status: 'PASS',
        detail: `NTP client is enabled with servers configured: ${ntp.servers || ntp['primary-ntp'] || 'dynamic'}`,
      });
    } else {
      items.push({
        pillar: 'Pillar 5: Time Synchronization',
        title: 'NTP Client Status',
        status: 'WARN',
        detail: 'NTP client is disabled. Router clock drift may cause TLS handshake errors, invalid certificate checks, and incorrect logs.',
        recommendation: 'Enable NTP client with standard pool servers.',
        remediationCommand: '/system ntp client set enabled=yes servers=0.pool.ntp.org,1.pool.ntp.org',
      });
    }

    // Pillar 6: Firewall Filter Input Protection
    const dropsInvalidInput = filters.some(
      (f) => f.chain === 'input' && f.action === 'drop' && f['connection-state']?.includes('invalid')
    );
    if (dropsInvalidInput) {
      items.push({
        pillar: 'Pillar 6: Firewall Integrity',
        title: 'Drop Invalid Connections',
        status: 'PASS',
        detail: 'Firewall filter input chain drops invalid connection states.',
      });
    } else {
      items.push({
        pillar: 'Pillar 6: Firewall Integrity',
        title: 'Drop Invalid Connections',
        status: 'WARN',
        detail: 'No rule found dropping invalid connection state in input chain.',
        recommendation: 'Add drop rule for invalid connections at top of input chain.',
        remediationCommand: '/ip firewall filter add chain=input connection-state=invalid action=drop comment="Drop Invalid Input"',
      });
    }

    // Pillar 7: Resource & Health Metrics
    const cpuLoad = typeof resource['cpu-load'] === 'string' ? parseInt(resource['cpu-load'], 10) : Number(resource['cpu-load'] || 0);
    if (cpuLoad > 85) {
      items.push({
        pillar: 'Pillar 7: System Health',
        title: 'CPU Utilization',
        status: 'WARN',
        detail: `CPU utilization is elevated at ${cpuLoad}%.`,
      });
    } else {
      items.push({
        pillar: 'Pillar 7: System Health',
        title: 'CPU Utilization',
        status: 'PASS',
        detail: `CPU utilization is normal at ${cpuLoad}%.`,
      });
    }

    const hasCritical = items.some((i) => i.status === 'CRITICAL');
    const hasWarn = items.some((i) => i.status === 'WARN');
    const overallScore = hasCritical ? 'VULNERABLE' : hasWarn ? 'NEEDS_ATTENTION' : 'SECURE';

    // Assign stable numbered finding IDs (F-01, F-02, ...)
    items.forEach((item, index) => {
      item.id = `F-${String(index + 1).padStart(2, '0')}`;
    });

    return {
      timestamp: new Date().toISOString(),
      routerIdentity: resource.board || resource.platform || 'MikroTik RouterOS',
      firmwareVersion: resource.version || 'v7.x',
      overallScore,
      items,
    };
  }

  static formatMarkdownReport(report: AuditReport): string {
    const lines: string[] = [];
    lines.push(`# RouterOS v7 Security & Configuration Audit Report`);
    lines.push(`\n**Target Device:** \`${report.routerIdentity}\` | **Firmware:** \`${report.firmwareVersion}\` | **Timestamp:** \`${report.timestamp}\``);
    lines.push(`**Overall Assessment:** **${report.overallScore}**\n`);

    const criticalCount = report.items.filter((i) => i.status === 'CRITICAL').length;
    const warnCount = report.items.filter((i) => i.status === 'WARN').length;
    const passCount = report.items.filter((i) => i.status === 'PASS').length;
    const infoCount = report.items.filter((i) => i.status === 'INFO').length;

    lines.push(`| Severity | Count | Status Summary |`);
    lines.push(`|---|:---:|---|`);
    lines.push(`| 🔴 CRITICAL | ${criticalCount} | Immediate security risk or packet misrouting |`);
    lines.push(`| 🟡 WARN | ${warnCount} | Unhardened service or suboptimal configuration |`);
    lines.push(`| 🟢 PASS | ${passCount} | Compliant with RouterOS v7 security standard |`);
    lines.push(`| 🔵 INFO | ${infoCount} | Informational advisory |`);
    lines.push(`\n---`);

    lines.push(`\n## Detailed Numbered Findings\n`);
    lines.push(`| ID | Pillar | Severity | Title | Finding & Recommendation |`);
    lines.push(`|---|---|:---:|---|---|`);

    for (const item of report.items) {
      const badge = item.status === 'CRITICAL' ? '🔴 CRITICAL' : item.status === 'WARN' ? '🟡 WARN' : item.status === 'PASS' ? '🟢 PASS' : '🔵 INFO';
      const rec = item.recommendation ? `<br>👉 *Rec: ${item.recommendation}*` : '';
      lines.push(`| **${item.id || '-'}** | ${item.pillar} | ${badge} | **${item.title}** | ${item.detail}${rec} |`);
    }

    const remediations = report.items.filter((i) => i.remediationCommand && (i.status === 'CRITICAL' || i.status === 'WARN'));
    if (remediations.length > 0) {
      lines.push(`\n---`);
      lines.push(`\n## Proposed Remediation Runbook\n`);
      lines.push(`> [!IMPORTANT]\n> Review proposed commands before applying. In interactive mode, select specific finding IDs to generate a targeted dry-run.\n`);
      lines.push('```routeros');
      for (const r of remediations) {
        lines.push(`# [${r.id}] ${r.title} (${r.status})`);
        lines.push(`${r.remediationCommand}`);
      }
      lines.push('```');
    }

    return lines.join('\n');
  }
}

