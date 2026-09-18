import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigSanitizer } from '../src/safety/sanitizer.js';

describe('ConfigSanitizer', () => {
  test('redacts MAC addresses in raw configuration strings', () => {
    const raw = 'add address=172.16.0.2 mac-address=10:7B:44:30:E0:01 comment="Server"';
    const sanitized = ConfigSanitizer.sanitizeText(raw);
    assert.equal(sanitized.includes('10:7B:44:30:E0:01'), false);
    assert.equal(sanitized.includes('XX:XX:XX:XX:XX:XX'), true);
  });

  test('redacts serial numbers and software IDs', () => {
    const raw = '# serial number = HJP0AP2JNZK\n# software id = 8154-10WV';
    const sanitized = ConfigSanitizer.sanitizeText(raw);
    assert.equal(sanitized.includes('HJP0AP2JNZK'), false);
    assert.equal(sanitized.includes('8154-10WV'), false);
    assert.match(sanitized, /\[REDACTED_SERIAL\]/);
    assert.match(sanitized, /\[REDACTED_ID\]/);
  });

  test('redacts passwords, pre-shared secrets, and tunnel tokens', () => {
    const raw = 'password="MySuperSecret123" shared-secret="RadiusKey2026" TUNNEL_TOKEN="eyJh..."';
    const sanitized = ConfigSanitizer.sanitizeText(raw);
    assert.equal(sanitized.includes('MySuperSecret123'), false);
    assert.equal(sanitized.includes('RadiusKey2026'), false);
    assert.equal(sanitized.includes('eyJh...'), false);
    assert.match(sanitized, /password="(\*{8})"/);
    assert.match(sanitized, /shared-secret="(\*{8})"/);
    assert.match(sanitized, /TUNNEL_TOKEN="(\*{8})"/);
  });

  test('redacts ZeroTier network IDs', () => {
    const raw = 'add disabled=no instance=zt1 name=zerotier1 network=743993800f034392';
    const sanitized = ConfigSanitizer.sanitizeText(raw);
    assert.equal(sanitized.includes('743993800f034392'), false);
    assert.match(sanitized, /\[REDACTED_ZT_NETWORK\]/);
  });

  test('deeply sanitizes structured JSON objects', () => {
    const obj = {
      router: {
        serial: 'HJP0AP2JNZK',
      },
      leases: [
        {
          ip: '172.16.0.2',
          mac: '10:7B:44:30:E0:01',
          secret: 'MySecretPassword',
        },
      ],
    };

    const sanitized = ConfigSanitizer.sanitizeObject(obj);
    const serialized = JSON.stringify(sanitized);

    assert.equal(serialized.includes('10:7B:44:30:E0:01'), false);
    assert.equal(serialized.includes('HJP0AP2JNZK'), false);
    assert.equal(serialized.includes('MySecretPassword'), false);
    assert.equal(serialized.includes('XX:XX:XX:XX:XX:XX'), true);
  });
});
