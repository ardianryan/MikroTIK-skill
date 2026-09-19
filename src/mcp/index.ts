#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadRouterConfig } from '../config/profile.js';
import { ConnectionManager } from '../client/connection-manager.js';
import { SecurityAuditor } from '../safety/auditor.js';
import { MangleOrderEngine } from '../safety/order-engine.js';
import { SafeModeWatchdog } from '../safety/watchdog.js';
import { ConfigSanitizer } from '../safety/sanitizer.js';

const server = new Server(
  {
    name: 'mikrotik-skill',
    version: '1.0.2',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'mikrotik_test_connection',
        description: 'Verify connectivity to MikroTik RouterOS v7 via REST API or Native API Port 8728 fallback.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'mikrotik_get_system_status',
        description: 'Get CPU utilization, memory, uptime, RouterOS version, and hardware platform overview.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'mikrotik_audit_security',
        description: 'Run automated 7-Pillar Security Audit covering DNS open resolvers, exposed services, NTP drift, and Hairpin NAT Mangle order.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'mikrotik_list_mangle',
        description: 'Retrieve all active firewall mangle rules in sequential order with hierarchy breakdown.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'mikrotik_force_routing',
        description: 'Safely assign a client IP to a specific routing table (ISP1/ISP2) with placement hierarchy and FIB table verification.',
        inputSchema: {
          type: 'object',
          properties: {
            ip: { type: 'string', description: 'Client IP address to route' },
            table: { type: 'string', description: 'Target routing table mark (e.g. to_ISP1 or to_ISP2)' },
            comment: { type: 'string', description: 'Descriptive comment for the rule' },
            dryRun: { type: 'boolean', description: 'If true, returns validation without applying changes' },
          },
          required: ['ip', 'table'],
        },
      },
      {
        name: 'mikrotik_manage_dhcp_lease',
        description: 'List DHCP leases or add a static DHCP reservation.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['list', 'add'], description: 'Action to perform' },
            ip: { type: 'string', description: 'IP address (required for add)' },
            mac: { type: 'string', description: 'MAC address (required for add)' },
            comment: { type: 'string', description: 'Client description or hostname' },
          },
          required: ['action'],
        },
      },
      {
        name: 'mikrotik_export_sanitized_config',
        description: 'Export router configuration with all sensitive identifiers (MACs, serials, passwords, keys) sanitized and redacted.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'mikrotik_manage_container',
        description: 'List active containers or restart a container on RouterOS v7.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['list', 'restart'], description: 'Container action' },
            id: { type: 'string', description: 'Container ID or name (required for restart)' },
          },
          required: ['action'],
        },
      },
      {
        name: 'mikrotik_get_adlist_status',
        description: 'List active DNS adblocker feed lists on RouterOS v7.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const config = loadRouterConfig();
  const conn = new ConnectionManager(config);

  try {
    switch (name) {
      case 'mikrotik_test_connection': {
        const res = await conn.testConnection();
        return {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
        };
      }

      case 'mikrotik_get_system_status': {
        const [res, ifaces, leases] = await Promise.all([
          conn.getResource(),
          conn.getInterfaces().catch(() => []),
          conn.getDhcpLeases().catch(() => []),
        ]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  resource: res,
                  interfacesTotal: ifaces.length,
                  dhcpLeasesCount: leases.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'mikrotik_audit_security': {
        const auditor = new SecurityAuditor(conn);
        const report = await auditor.runFullAudit();
        return {
          content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
        };
      }

      case 'mikrotik_list_mangle': {
        const rules = await conn.getMangleRules();
        const analysis = MangleOrderEngine.analyzePlacement(rules, config.localBypassList);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ analysis, rules }, null, 2),
            },
          ],
        };
      }

      case 'mikrotik_force_routing': {
        const ip = String(args?.ip);
        const table = String(args?.table);
        const comment = String(args?.comment || 'Forced client routing via MCP');
        const dryRun = Boolean(args?.dryRun);

        const [tables, rules] = await Promise.all([
          conn.getRoutingTables(),
          conn.getMangleRules(),
        ]);

        const validation = MangleOrderEngine.validateRoutingMark(table, tables);
        if (!validation.valid) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Validation Error: ${validation.reason}` }],
          };
        }

        const analysis = MangleOrderEngine.analyzePlacement(rules, config.localBypassList);
        const ruleData = {
          chain: 'prerouting',
          action: 'mark-routing',
          'src-address': ip,
          'new-routing-mark': table,
          passthrough: 'no',
          comment,
        };

        if (dryRun) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'DRY_RUN_SUCCESS',
                    recommendedIndex: analysis.recommendedIndex,
                    rule: ruleData,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const watchdog = new SafeModeWatchdog(conn);
        await watchdog.arm(`/ip/firewall/mangle/remove [find comment="${comment}"]`, config.watchdogTimeout);
        await conn.addMangleRule(ruleData);

        const health = await conn.testConnection();
        if (health.successful) {
          await watchdog.disarm();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ status: 'APPLIED_AND_VERIFIED', rule: ruleData }, null, 2),
              },
            ],
          };
        } else {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Mutation resulted in connectivity degradation. Watchdog triggered rollback.' }],
          };
        }
      }

      case 'mikrotik_manage_dhcp_lease': {
        const action = args?.action;
        if (action === 'add') {
          const ip = String(args?.ip);
          const mac = String(args?.mac);
          const comment = String(args?.comment || 'Static reservation via MCP');
          await conn.addDhcpLease({
            address: ip,
            'mac-address': mac,
            comment,
          });
          return {
            content: [{ type: 'text', text: `Successfully added static lease for ${ip} (${mac})` }],
          };
        } else {
          const leases = await conn.getDhcpLeases();
          return {
            content: [{ type: 'text', text: JSON.stringify(leases, null, 2) }],
          };
        }
      }

      case 'mikrotik_export_sanitized_config': {
        const [resource, mangle, leases, tables, filters, services] = await Promise.all([
          conn.getResource(),
          conn.getMangleRules().catch(() => []),
          conn.getDhcpLeases().catch(() => []),
          conn.getRoutingTables().catch(() => []),
          conn.getFirewallFilters().catch(() => []),
          conn.getIpServices().catch(() => []),
        ]);

        const rawData = {
          meta: {
            exportedAt: new Date().toISOString(),
            router: resource.board || resource.platform || 'MikroTik',
            version: resource.version || 'v7.x',
          },
          routingTables: tables,
          mangleRules: mangle,
          firewallFilters: filters,
          dhcpLeases: leases,
          ipServices: services,
        };

        const sanitized = ConfigSanitizer.sanitizeObject(rawData);
        return {
          content: [{ type: 'text', text: JSON.stringify(sanitized, null, 2) }],
        };
      }

      case 'mikrotik_manage_container': {
        const action = args?.action;
        if (action === 'restart') {
          const id = String(args?.id);
          await conn.restartContainer(id);
          return {
            content: [{ type: 'text', text: `Container ${id} restart command dispatched.` }],
          };
        } else {
          const containers = await conn.getContainers();
          return {
            content: [{ type: 'text', text: JSON.stringify(containers, null, 2) }],
          };
        }
      }

      case 'mikrotik_get_adlist_status': {
        const adlists = await conn.getDnsAdlists();
        return {
          content: [{ type: 'text', text: JSON.stringify(adlists, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Tool error: ${err instanceof Error ? err.message : String(err)}` }],
    };
  } finally {
    await conn.close();
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal MCP Server error:', err);
  process.exit(1);
});
