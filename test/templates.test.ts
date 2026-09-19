import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CertifiedTemplateGenerator, type CertificationTrack } from '../src/safety/templates.js';

describe('CertifiedTemplateGenerator', () => {
  const tracks: CertificationTrack[] = [
    'mtcswe',
    'mtcine',
    'mtcewe',
    'mtcwe',
    'mtcre',
    'mtctce',
    'mtcse',
    'mtcipv6e',
    'mtcume',
    'mtcna',
  ];

  test('provides templates for all 10 MikroTik Certification tracks', () => {
    for (const track of tracks) {
      const tpl = CertifiedTemplateGenerator.get(track);
      assert.ok(tpl, `Missing template for track: ${track}`);
      assert.equal(tpl.track, track);
      assert.ok(tpl.title.length > 5);
      assert.ok(tpl.script.length > 20);
    }
  });

  test('lists all registered templates', () => {
    const list = CertifiedTemplateGenerator.list();
    assert.equal(list.length, 10);
  });

  test('returns undefined for unknown track', () => {
    const unknown = CertifiedTemplateGenerator.get('unknown-track');
    assert.equal(unknown, undefined);
  });
});
