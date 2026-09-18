import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { McpInstaller } from '../src/mcp/installer.js';

describe('McpInstaller', () => {
  test('resolves config paths for all supported IDEs', () => {
    const paths = McpInstaller.getIdeConfigPaths();
    assert.ok(paths.antigravity);
    assert.ok(paths.cursor);
    assert.ok(paths.claude);
    assert.ok(paths.windsurf);
    assert.match(paths.antigravity, /mcp_config\.json/);
    assert.match(paths.claude, /claude_desktop_config\.json/);
  });

  test('builds server configuration with global binary executable', () => {
    const cfg = McpInstaller.buildServerConfig({ useGlobal: true });
    assert.equal(cfg.command, 'mtik-mcp');
    assert.deepEqual(cfg.args, []);
  });

  test('builds server configuration with node script path when not global', () => {
    const cfg = McpInstaller.buildServerConfig({ useGlobal: false });
    assert.equal(cfg.command, 'node');
    assert.ok(Array.isArray(cfg.args));
    assert.match(String(cfg.args[0]), /index\.js/);
  });

  test('populates router environment variables when provided', () => {
    const mockRouter = {
      host: '10.0.0.1',
      user: 'admin',
      password: 'password123',
      restPort: 443,
      useSsl: true,
      apiPort: 8728,
      apiSslPort: 8729,
      preferBinary: false,
      watchdogTimeout: 30,
      wanPrimaryTable: 'to_ISP1',
      wanSecondaryTable: 'to_ISP2',
      localBypassList: 'LOCAL_BYPASS',
    };

    const cfg = McpInstaller.buildServerConfig({ useGlobal: true, config: mockRouter });
    const env = cfg.env as Record<string, string>;
    assert.ok(env);
    assert.equal(env.ROUTEROS_HOST, '10.0.0.1');
    assert.equal(env.ROUTEROS_USER, 'admin');
    assert.equal(env.ROUTEROS_PASSWORD, 'password123');
    assert.equal(env.ROUTEROS_REST_PORT, '443');
    assert.equal(env.ROUTEROS_USE_SSL, 'true');
  });
});
