import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { ConfigSanitizer } from '../safety/sanitizer.js';
import { CertifiedTemplateGenerator, type CertificationTrack } from '../safety/templates.js';
import { MangleOrderEngine } from '../safety/order-engine.js';
import { ChatPromptExporter } from '../safety/prompt-export.js';
import { OpenApiGenerator } from './openapi.js';

export interface HttpServerOptions {
  port?: number;
  apiKey?: string;
  serverUrl?: string;
}

export class MikroTikHttpServer {
  private serverUrl: string;

  constructor(options: HttpServerOptions = {}) {
    this.serverUrl = options.serverUrl || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  }

  private sendJson(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    });
    res.end(JSON.stringify(data, null, 2));
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

    // 1. Root & Discovery Endpoints
    if (pathname === '/' && method === 'GET') {
      this.sendJson(res, 200, {
        name: 'mikrotik-skill',
        version: '1.1.0',
        mode: 'knowledge-and-intelligence',
        description: 'MikroTik RouterOS v7 Certified Knowledge & OpenAPI Gateway. Zero router credentials required.',
        openapi: `${origin}/openapi.json`,
        health: `${origin}/health`,
        tracks: `${origin}/api/v1/knowledge/tracks`,
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

    // 2. Pure Knowledge & Intelligence Endpoints (100% Offline, Zero Router Credentials Needed)
    if (pathname === '/api/v1/knowledge/tracks' && method === 'GET') {
      const tracks = CertifiedTemplateGenerator.list();
      this.sendJson(res, 200, tracks);
      return;
    }

    if (pathname === '/api/v1/knowledge/template' && method === 'GET') {
      const track = (reqUrl.searchParams.get('track') || '').toLowerCase() as CertificationTrack;
      const tpl = CertifiedTemplateGenerator.get(track);
      if (!tpl) {
        this.sendJson(res, 400, {
          error: 'Invalid or missing track parameter.',
          availableTracks: CertifiedTemplateGenerator.list().map((t) => t.track),
        });
        return;
      }
      this.sendJson(res, 200, tpl);
      return;
    }

    if (pathname === '/api/v1/knowledge/prompt' && method === 'GET') {
      const systemPrompt = ChatPromptExporter.getSystemPrompt();
      this.sendJson(res, 200, { systemPrompt });
      return;
    }

    if (pathname === '/api/v1/knowledge/validate' && method === 'POST') {
      const body = await this.parseBody(req);
      const routingMark = String(body.routingMark || '');
      const existingTables = Array.isArray(body.existingTables)
        ? body.existingTables.map((t) => ({ name: String(t), fib: true }))
        : [{ name: routingMark, fib: true }];

      if (!routingMark) {
        this.sendJson(res, 400, { error: 'Parameter "routingMark" is required.' });
        return;
      }

      const result = MangleOrderEngine.validateRoutingMark(routingMark, existingTables as any);
      this.sendJson(res, 200, result);
      return;
    }

    if (pathname === '/api/v1/knowledge/sanitize' && method === 'POST') {
      const body = await this.parseBody(req);
      const configText = String(body.configText || '');
      if (!configText) {
        this.sendJson(res, 400, { error: 'Parameter "configText" is required.' });
        return;
      }

      const sanitized = ConfigSanitizer.sanitizeText(configText);
      this.sendJson(res, 200, { sanitized });
      return;
    }

    this.sendJson(res, 404, { error: 'Endpoint not found', path: pathname });
  }

  listen(port: number = 3000): http.Server {
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });
    server.listen(port);
    return server;
  }
}
