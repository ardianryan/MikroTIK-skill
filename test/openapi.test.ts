import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { OpenApiGenerator } from '../src/server/openapi.js';

describe('OpenApiGenerator', () => {
  test('generates valid OpenAPI 3.1.0 schema', () => {
    const spec = OpenApiGenerator.getSpecification('https://test-mcp.vercel.app');
    assert.equal(spec.openapi, '3.1.0');
    assert.ok(spec.info && typeof spec.info === 'object');
    assert.equal((spec.info as { title: string }).title, 'MikroTik RouterOS v7 Certified Automation API');
  });

  test('includes key operations for ChatGPT actions', () => {
    const spec = OpenApiGenerator.getSpecification();
    const paths = spec.paths as Record<string, Record<string, unknown>>;
    assert.ok(paths['/api/v1/action/status']);
    assert.ok(paths['/api/v1/action/audit']);
    assert.ok(paths['/api/v1/action/route-force']);
    assert.ok(paths['/api/v1/action/exec']);
    assert.ok(paths['/api/v1/action/template']);
  });

  test('includes BearerAuth security scheme', () => {
    const spec = OpenApiGenerator.getSpecification();
    const components = spec.components as { securitySchemes: { BearerAuth: { type: string; scheme: string } } };
    assert.ok(components.securitySchemes.BearerAuth);
    assert.equal(components.securitySchemes.BearerAuth.type, 'http');
    assert.equal(components.securitySchemes.BearerAuth.scheme, 'bearer');
  });
});
