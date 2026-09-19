import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SecurityAuditor } from '../src/safety/auditor.js';
import type { ConnectionManager } from '../src/client/connection-manager.js';

describe('SecurityAuditor', () => {
  test('flags CRITICAL when allow-remote-requests=yes without firewall drop rule on UDP 53', async () => {
    const mockConn = {
      getResource: async () => ({ version: '7.16', board: 'RB5009UG+S+IN' }),
      getDnsSettings: async () => ({ 'allow-remote-requests': true }),
      getFirewallFilters: async () => [], // No drop rules
      getIpServices: async () => [],
      getMangleRules: async () => [],
      getRoutingTables: async () => [],
      getNtpClient: async () => ({ enabled: true }),
    } as unknown as ConnectionManager;

    const auditor = new SecurityAuditor(mockConn);
    const report = await auditor.runFullAudit();

    const dnsItem = report.items.find((i) => i.title === 'DNS Open Resolver');
    assert.ok(dnsItem);
    assert.equal(dnsItem.status, 'CRITICAL');
    assert.equal(report.overallScore, 'VULNERABLE');
  });

  test('passes DNS check when WAN UDP 53 is explicitly dropped', async () => {
    const mockConn = {
      getResource: async () => ({ version: '7.16', board: 'RB5009UG+S+IN' }),
      getDnsSettings: async () => ({ 'allow-remote-requests': true }),
      getFirewallFilters: async () => [
        { chain: 'input', action: 'drop', protocol: 'udp', 'dst-port': '53' },
      ],
      getIpServices: async () => [],
      getMangleRules: async () => [],
      getRoutingTables: async () => [],
      getNtpClient: async () => ({ enabled: true }),
    } as unknown as ConnectionManager;

    const auditor = new SecurityAuditor(mockConn);
    const report = await auditor.runFullAudit();

    const dnsItem = report.items.find((i) => i.title === 'DNS Open Resolver');
    assert.ok(dnsItem);
    assert.equal(dnsItem.status, 'PASS');
  });

  test('flags WARN for unhardened sensitive service ports', async () => {
    const mockConn = {
      getResource: async () => ({ version: '7.16' }),
      getDnsSettings: async () => ({ 'allow-remote-requests': false }),
      getFirewallFilters: async () => [{ chain: 'input', action: 'drop', 'connection-state': 'invalid' }],
      getIpServices: async () => [
        { name: 'winbox', port: 8291, disabled: false, address: '' }, // Exposed to all
      ],
      getMangleRules: async () => [],
      getRoutingTables: async () => [],
      getNtpClient: async () => ({ enabled: true }),
    } as unknown as ConnectionManager;

    const auditor = new SecurityAuditor(mockConn);
    const report = await auditor.runFullAudit();

    const winboxItem = report.items.find((i) => i.title.includes('winbox'));
    assert.ok(winboxItem);
    assert.equal(winboxItem.status, 'WARN');
  });

  test('flags CRITICAL when bridge has protocol-mode=none (MTCSWE)', async () => {
    const mockConn = {
      getResource: async () => ({ version: '7.16', board: 'CRS326-24G-2S+' }),
      getDnsSettings: async () => ({ 'allow-remote-requests': false }),
      getFirewallFilters: async () => [{ chain: 'input', action: 'drop', 'connection-state': 'invalid' }],
      getIpServices: async () => [],
      getMangleRules: async () => [],
      getRoutingTables: async () => [],
      getNtpClient: async () => ({ enabled: true }),
      getBridges: async () => [{ name: 'bridge1', 'protocol-mode': 'none' }],
      getIpv6Filters: async () => [{ chain: 'input', action: 'drop' }],
    } as unknown as ConnectionManager;

    const auditor = new SecurityAuditor(mockConn);
    const report = await auditor.runFullAudit();

    const bridgeItem = report.items.find((i) => i.pillar.includes('Layer 2 Loop Protection'));
    assert.ok(bridgeItem);
    assert.equal(bridgeItem.status, 'CRITICAL');
    assert.equal(report.overallScore, 'VULNERABLE');
  });

  test('flags WARN when IPv6 firewall filter rules are absent (MTCIPv6E)', async () => {
    const mockConn = {
      getResource: async () => ({ version: '7.16', board: 'RB5009' }),
      getDnsSettings: async () => ({ 'allow-remote-requests': false }),
      getFirewallFilters: async () => [
        { chain: 'input', action: 'drop', 'connection-state': 'invalid' },
        { chain: 'forward', action: 'drop', 'connection-state': 'invalid' },
      ],
      getIpServices: async () => [],
      getMangleRules: async () => [],
      getRoutingTables: async () => [],
      getNtpClient: async () => ({ enabled: true }),
      getBridges: async () => [{ name: 'bridge1', 'protocol-mode': 'rstp' }],
      getIpv6Filters: async () => [],
    } as unknown as ConnectionManager;

    const auditor = new SecurityAuditor(mockConn);
    const report = await auditor.runFullAudit();

    const ipv6Item = report.items.find((i) => i.pillar.includes('IPv6 Security'));
    assert.ok(ipv6Item);
    assert.equal(ipv6Item.status, 'WARN');
  });
});
