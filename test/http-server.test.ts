import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { MikroTikHttpServer } from '../src/server/http.js';

describe('MikroTikHttpServer (Pure Knowledge Engine)', () => {
  const server = new MikroTikHttpServer();
  const httpServer = server.listen(0);
  const port = (httpServer.address() as AddressInfo).port;
  const baseUrl = `http://localhost:${port}`;

  after(() => {
    httpServer.close();
  });

  test('GET / returns metadata with mcp endpoints and tracks link', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as { name: string; version: string; mode: string; mcp?: { sse: string; streamableHttp: string } };
    assert.equal(data.name, 'mikrotik-skill');
    assert.equal(data.version, '1.1.0');
    assert.equal(data.mode, 'knowledge-and-intelligence');
    assert.ok(data.mcp?.sse.includes('/sse'));
    assert.ok(data.mcp?.streamableHttp.includes('/mcp'));
  });

  test('GET /sse establishes native MCP SSE transport and emits endpoint event', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/sse`, { signal: controller.signal });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type')?.includes('text/event-stream'), true);
    
    const reader = res.body?.getReader();
    assert.ok(reader);
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    assert.ok(text.includes('event: endpoint'));
    assert.ok(text.includes('/api/messages?sessionId='));
    controller.abort();
  });

  test('GET /api returns metadata catalog directly', async () => {
    const res = await fetch(`${baseUrl}/api`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as { name: string; version: string };
    assert.equal(data.name, 'mikrotik-skill');
  });

  test('GET /api?path=/openapi.json resolves rewritten Vercel serverless request', async () => {
    const res = await fetch(`${baseUrl}/api?path=/openapi.json`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as { openapi: string };
    assert.equal(data.openapi, '3.1.0');
  });

  test('GET /health returns healthy', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as { status: string };
    assert.equal(data.status, 'healthy');
  });

  test('GET /openapi.json returns OpenAPI 3.1.0 specification', async () => {
    const res = await fetch(`${baseUrl}/openapi.json`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as { openapi: string };
    assert.equal(data.openapi, '3.1.0');
  });

  test('GET /api/v1/knowledge/tracks returns all 10 tracks without credentials', async () => {
    const res = await fetch(`${baseUrl}/api/v1/knowledge/tracks`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as Array<{ track: string }>;
    assert.equal(data.length, 10);
  });

  test('GET /api/v1/knowledge/template returns certified template without credentials', async () => {
    const res = await fetch(`${baseUrl}/api/v1/knowledge/template?track=mtcswe`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as { track: string; script: string };
    assert.equal(data.track, 'mtcswe');
    assert.ok(data.script.includes('/interface bridge'));
  });

  test('POST /api/v1/knowledge/sanitize redacts secrets offline', async () => {
    const res = await fetch(`${baseUrl}/api/v1/knowledge/sanitize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configText: 'set password=MySecret123 mac-address=00:0C:42:01:02:03' }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { sanitized: string };
    assert.ok(data.sanitized.includes('********'));
    assert.ok(!data.sanitized.includes('MySecret123'));
  });

  test('POST /api/v1/knowledge/validate verifies routing mark offline', async () => {
    const res = await fetch(`${baseUrl}/api/v1/knowledge/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routingMark: 'to_ISP1' }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { valid: boolean };
    assert.equal(data.valid, true);
  });

  test('GET /api/v1/knowledge/prompt returns system instructions', async () => {
    const res = await fetch(`${baseUrl}/api/v1/knowledge/prompt`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as { systemPrompt: string };
    assert.ok(data.systemPrompt.includes('RouterOS v7'));
  });
});
