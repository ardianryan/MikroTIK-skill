import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MangleOrderEngine } from '../src/safety/order-engine.js';
import type { MangleRule, RoutingTable } from '../src/client/types.js';

describe('MangleOrderEngine', () => {
  test('correctly identifies bypass rules (Hairpin NAT and LOCAL_BYPASS)', () => {
    const hairpinRule: MangleRule = {
      chain: 'prerouting',
      action: 'accept',
      'connection-nat-state': 'dstnat',
    };
    assert.equal(MangleOrderEngine.isBypassRule(hairpinRule), true);

    const localBypassRule: MangleRule = {
      chain: 'prerouting',
      action: 'accept',
      'dst-address-list': 'LOCAL_BYPASS',
    };
    assert.equal(MangleOrderEngine.isBypassRule(localBypassRule, 'LOCAL_BYPASS'), true);

    const routingRule: MangleRule = {
      chain: 'prerouting',
      action: 'mark-routing',
      'new-routing-mark': 'to_ISP1',
    };
    assert.equal(MangleOrderEngine.isBypassRule(routingRule), false);
  });

  test('correctly identifies PCC load balancing rules', () => {
    const pccRule: MangleRule = {
      chain: 'prerouting',
      action: 'mark-connection',
      'per-connection-classifier': 'both-addresses:2/0',
    };
    assert.equal(MangleOrderEngine.isPccRule(pccRule), true);

    const standardRule: MangleRule = {
      chain: 'prerouting',
      action: 'mark-routing',
      'src-address': '192.168.88.50',
      'new-routing-mark': 'to_ISP1',
    };
    assert.equal(MangleOrderEngine.isPccRule(standardRule), false);
  });

  test('validates routing mark registration and FIB flag in RouterOS v7', () => {
    const tables: RoutingTable[] = [
      { name: 'to_ISP1', fib: true },
      { name: 'to_ISP2', fib: false },
    ];

    const validCheck = MangleOrderEngine.validateRoutingMark('to_ISP1', tables);
    assert.equal(validCheck.valid, true);

    const invalidFibCheck = MangleOrderEngine.validateRoutingMark('to_ISP2', tables);
    assert.equal(invalidFibCheck.valid, false);
    assert.match(invalidFibCheck.reason || '', /fib=no/);

    const missingTableCheck = MangleOrderEngine.validateRoutingMark('to_ISP3', tables);
    assert.equal(missingTableCheck.valid, false);
    assert.match(missingTableCheck.reason || '', /does not exist/);
  });

  test('calculates placement index right after bypass rules and before PCC', () => {
    const rules: MangleRule[] = [
      { chain: 'prerouting', action: 'accept', 'connection-nat-state': 'dstnat' },
      { chain: 'prerouting', action: 'accept', 'dst-address-list': 'LOCAL_BYPASS' },
      { chain: 'prerouting', action: 'mark-connection', 'per-connection-classifier': 'both-addresses:2/0' },
      { chain: 'prerouting', action: 'mark-connection', 'per-connection-classifier': 'both-addresses:2/1' },
    ];

    const analysis = MangleOrderEngine.analyzePlacement(rules, 'LOCAL_BYPASS');
    assert.equal(analysis.bypassCount, 2);
    assert.equal(analysis.pccCount, 2);
    assert.equal(analysis.recommendedIndex, 2);
  });
});
