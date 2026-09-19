import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { loadRouterConfig } from '../config/profile.js';
import { ConnectionManager } from '../client/connection-manager.js';
import { SecurityAuditor } from '../safety/auditor.js';
import { MangleOrderEngine } from '../safety/order-engine.js';
import { SafeModeWatchdog } from '../safety/watchdog.js';
import { ConfigSanitizer } from '../safety/sanitizer.js';
import { CertifiedTemplateGenerator, type CertificationTrack } from '../safety/templates.js';
import { OpenApiGenerator } from './openapi.js';

export interface HttpServerOptions {
  port?: number;
  apiKey?: string;
  serverUrl?: string;
}

export class MikroTikHttpServer {
  private apiKey: string;
  private serverUrl: string;

  constructor(options: HttpServerOptions = {}) {
    this.apiKey = options.apiKey || process.env.MTIK_API_KEY || '';
    this.serverUrl = options.serverUrl || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
  }

  private authenticate(req: IncomingMessage, res: ServerResponse): boolean {
    if (!this.apiKey) {
      return true; // No authentication configured
    }

    const authHeader = req.headers.authorization || '';
    const xApiKey = req.headers['x-api-key'];

    let providedToken = '';
    if (authHeader.startsWith('Bearer ')) {
      providedToken = authHeader.substring(7).trim();
    } else if (typeof xApiKey === 'string') {
      providedToken = xApiKey.trim();
    }

    if (providedToken !== this.apiKey) {
      this.sendJson(res, 401, {
        error: 'Unauthorized',
        message: 'Invalid or missing Bearer token in Authorization header.',
      });
      return false;
    }
    return true;
  }

  private sendJson(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    });
    res.end(JSON.stringify(ConfigSanitizer.sanitizeJson(data), null, 2));
  }

  private async parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });
    });
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const origin = req.headers.host ? `http://${req.headers.host}` : this.serverUrl;
    const reqUrl = new URL(req.url || '/', origin);
    const pathname = reqUrl.pathname;
    const method = (req.method || 'GET').toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      });
      res.end();
      return;
    }

    // Public routes (no auth required)
    if (pathname === '/' && method === 'GET') {
      this.sendJson(res, 200, {
        name: 'mikrotik-skill',
        version: '1.1.0',
        description: 'MikroTik RouterOS v7 Production Automation & ChatGPT Action Gateway',
        openapi: `${origin}/openapi.json`,
        health: `${origin}/health`,
      });
      return;
    }

    if (pathname === '/health' && method === 'GET') {
      this.sendJson(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
      return;
    }

    if (pathname === '/openapi.json' && method === 'GET') {
      const spec = OpenApiGenerator.getSpecification(origin);
      this.sendJson(res, 200, spec);
      return;
    }

    // Authenticated API routes
    if (!this.authenticate(req, res)) {
      return;
    }

    const config = loadRouterConfig();
    const conn = new ConnectionManager(config);

    try {
      if (pathname === '/api/v1/action/status' && method === 'GET') {
        const [resource, ifaces, leases] = await Promise.all([
          conn.getResource(),
          conn.getInterfaces().catch(() => []),
          conn.getDhcpLeases().catch(() => []),
        ]);
        this.sendJson(res, 200, {
          resource,
          interfacesTotal: ifaces.length,
          dhcpLeasesCount: leases.length,
        });
        return;
      }

      if (pathname === '/api/v1/action/audit' && method === 'GET') {
        const auditor = new SecurityAuditor(conn);
        const report = await auditor.runFullAudit();
        this.sendJson(res, 200, report);
        return;
      }

      if (pathname === '/api/v1/action/template' && method === 'GET') {
        const track = (reqUrl.searchParams.get('track') || '').toLowerCase() as CertificationTrack;
        const tpl = CertifiedTemplateGenerator.get(track);
        if (!tpl) {
          this.sendJson(res, 400, {
            error: 'Invalid track',
            availableTracks: CertifiedTemplateGenerator.list().map((t) => t.track),
          });
          return;
        }
        this.sendJson(res, 200, tpl);
        return;
      }

      if (pathname === '/api/v1/action/route-force' && method === 'POST') {
        const body = await this.parseBody(req);
        const ip = String(body.ip || '');
        const table = String(body.table || '');
        const comment = String(body.comment || 'Forced client routing via ChatGPT Action');
        const dryRun = Boolean(body.dryRun);

        if (!ip || !table) {
          this.sendJson(res, 400, { error: 'Parameters "ip" and "table" are required.' });
          return;
        }

        const [tables, rules] = await Promise.all([
          conn.getRoutingTables(),
          conn.getMangleRules(),
        ]);

        const validation = MangleOrderEngine.validateRoutingMark(table, tables);
        if (!validation.valid) {
          this.sendJson(res, 400, { error: validation.reason });
          return;
        }

        const analysis = MangleOrderEngine.analyzePlacement(rules, config.localBypassList);
        const targetRule = {
          chain: 'prerouting',
          action: 'mark-routing',
          'src-address': ip,
          'new-routing-mark': table,
          passthrough: 'no',
          comment,
        };

        if (dryRun) {
          this.sendJson(res, 200, {
            status: 'dry-run',
            recommendedIndex: analysis.recommendedIndex,
            proposedRule: targetRule,
          });
          return;
        }

        const watchdog = new SafeModeWatchdog(conn);
        await watchdog.arm(`/ip/firewall/mangle/remove [find comment="${comment}"]`, config.watchdogTimeout);
        await conn.addMangleRule(targetRule);
        const test = await conn.testConnection();
        if (test.successful) {
          await watchdog.disarm();
          this.sendJson(res, 200, { status: 'success', appliedRule: targetRule });
        } else {
          this.sendJson(res, 500, { error: 'Router heartbeat failed. Watchdog rollback triggered.' });
        }
        return;
      }

      if (pathname === '/api/v1/action/exec' && method === 'POST') {
        const body = await this.parseBody(req);
        const command = String(body.command || '').trim();
        if (!command) {
          this.sendJson(res, 400, { error: 'Parameter "command" is required.' });
          return;
        }

        const result = await conn.executeScript(command);
        this.sendJson(res, 200, {
          status: 'success',
          command,
          result: result || 'Executed successfully',
        });
        return;
      }

      this.sendJson(res, 404, { error: 'Endpoint not found', path: pathname });
    } catch (err) {
      this.sendJson(res, 500, {
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      await conn.close();
    }
  }

  listen(port: number = 3000): http.Server {
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });
    server.listen(port);
    return server;
  }
}
