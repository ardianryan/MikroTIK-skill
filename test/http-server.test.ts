import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { MikroTikHttpServer } from '../src/server/http.js';

describe('MikroTikHttpServer', () => {
  const server = new MikroTikHttpServer({
    apiKey: 'secret-test-token',
  });
  const httpServer = server.listen(0);
  const port = (httpServer.address() as AddressInfo).port;
  const baseUrl = `http://localhost:${port}`;

  after(() => {
    httpServer.close();
  });

  test('GET / returns metadata', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as { name: string; version: string };
    assert.equal(data.name, 'mikrotik-skill');
    assert.equal(data.version, '1.1.0');
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

  test('rejects unauthenticated request to /api/v1/action/status', async () => {
    const res = await fetch(`${baseUrl}/api/v1/action/status`);
    assert.equal(res.status, 401);
    const data = (await res.json()) as { error: string };
    assert.equal(data.error, 'Unauthorized');
  });

  test('GET /api/v1/action/template with Bearer token returns certified template', async () => {
    const res = await fetch(`${baseUrl}/api/v1/action/template?track=mtcswe`, {
      headers: {
        Authorization: 'Bearer secret-test-token',
      },
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { track: string; script: string };
    assert.equal(data.track, 'mtcswe');
    assert.ok(data.script.length > 50);
  });
});
