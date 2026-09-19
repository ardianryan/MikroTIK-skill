import test, { describe } from 'node:test';
import assert from 'node:assert';
import { RouterOsRestClient } from '../src/client/rest-client.js';
import type { RouterConfig } from '../src/config/profile.js';

const mockConfig: RouterConfig = {
  host: '192.168.88.1',
  user: 'admin',
  password: 'testpassword',
  useSsl: false,
  restPort: 80,
  apiPort: 8728,
  preferRest: true,
};

describe('RouterOsRestClient', () => {
  test('formats execute script request properly', async () => {
    const client = new RouterOsRestClient(mockConfig);
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody = '';

    // Mock global.fetch
    const originalFetch = global.fetch;
    global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedMethod = init?.method || '';
      capturedBody = init?.body ? init.body.toString() : '';
      return new Response(JSON.stringify([{ ret: 'ok' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const res = await client.executeScript('/log info "audit"');
      assert.deepStrictEqual(res, [{ ret: 'ok' }]);
      assert.strictEqual(capturedUrl, 'http://192.168.88.1:80/rest/execute');
      assert.strictEqual(capturedMethod, 'POST');
      assert.strictEqual(JSON.parse(capturedBody).script, '/log info "audit"');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('formats export configuration request properly', async () => {
    const client = new RouterOsRestClient(mockConfig);
    let capturedUrl = '';
    let capturedBody = '';

    const originalFetch = global.fetch;
    global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedBody = init?.body ? init.body.toString() : '';
      return new Response(JSON.stringify({ status: 'done' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      await client.exportConfig({ compact: true, file: 'backup.rsc' });
      assert.strictEqual(capturedUrl, 'http://192.168.88.1:80/rest/export');
      const parsed = JSON.parse(capturedBody);
      assert.strictEqual(parsed.file, 'backup.rsc');
      assert.strictEqual(parsed.compact, '');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('formats move rule request properly', async () => {
    const client = new RouterOsRestClient(mockConfig);
    let capturedUrl = '';
    let capturedBody = '';

    const originalFetch = global.fetch;
    global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedBody = init?.body ? init.body.toString() : '';
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      await client.moveRule('/ip/firewall/mangle', '*10', '*2');
      assert.strictEqual(capturedUrl, 'http://192.168.88.1:80/rest/ip/firewall/mangle/move');
      const parsed = JSON.parse(capturedBody);
      assert.strictEqual(parsed['.id'], '*10');
      assert.strictEqual(parsed.destination, '*2');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('formats queryMenu with .proplist and .query stack properly', async () => {
    const client = new RouterOsRestClient(mockConfig);
    let capturedUrl = '';
    let capturedBody = '';

    const originalFetch = global.fetch;
    global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedBody = init?.body ? init.body.toString() : '';
      return new Response(JSON.stringify([{ '.id': '*1', name: 'ether1' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const res = await client.queryMenu<{ '.id': string; name: string }>('/interface', {
        proplist: ['.id', 'name', 'type'],
        query: ['type=ether', 'running=true', '#|&'],
      });
      assert.strictEqual(capturedUrl, 'http://192.168.88.1:80/rest/interface/print');
      const parsed = JSON.parse(capturedBody);
      assert.deepStrictEqual(parsed['.proplist'], ['.id', 'name', 'type']);
      assert.deepStrictEqual(parsed['.query'], ['type=ether', 'running=true', '#|&']);
      assert.strictEqual(res.length, 1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
