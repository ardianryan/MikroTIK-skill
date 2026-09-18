import type { MangleRule, RoutingTable } from '../client/types.js';

export interface ManglePlacementAnalysis {
  recommendedIndex: number;
  totalRules: number;
  bypassCount: number;
  dedicatedCount: number;
  pccCount: number;
  validationErrors: string[];
}

export class MangleOrderEngine {
  static isBypassRule(rule: MangleRule, bypassList: string = 'LOCAL_BYPASS'): boolean {
    if (rule.chain !== 'prerouting') {
      return false;
    }

    if (rule['connection-nat-state'] === 'dstnat' && rule.action === 'accept') {
      return true;
    }

    if (rule.action === 'accept' && (rule['dst-address-list'] === bypassList || rule['src-address-list'] === bypassList)) {
      return true;
    }

    if (rule.action === 'accept' && rule['dst-address'] && !rule['new-routing-mark']) {
      return true;
    }

    return false;
  }

  static isPccRule(rule: MangleRule): boolean {
    return Boolean(
      rule['per-connection-classifier'] ||
      (rule.comment && rule.comment.toLowerCase().includes('pcc')) ||
      (rule.action === 'mark-connection' && rule['new-connection-mark']?.includes('ISP'))
    );
  }

  static isDedicatedRoutingRule(rule: MangleRule): boolean {
    return Boolean(
      rule.action === 'mark-routing' &&
      rule['new-routing-mark'] &&
      !MangleOrderEngine.isPccRule(rule)
    );
  }

  static validateRoutingMark(targetMark: string, routingTables: RoutingTable[]): { valid: boolean; reason?: string } {
    const table = routingTables.find((t) => t.name === targetMark);
    if (!table) {
      return {
        valid: false,
        reason: `Routing mark '${targetMark}' does not exist in '/routing/table'. In RouterOS v7, routing tables must be explicitly defined.`,
      };
    }

    const isFib = table.fib === true || table.fib === 'true' || table.fib === 'yes';
    if (!isFib) {
      return {
        valid: false,
        reason: `Routing table '${targetMark}' exists but has 'fib=no'. RouterOS v7 requires FIB enabled for packet forwarding.`,
      };
    }

    return { valid: true };
  }

  static analyzePlacement(existingRules: MangleRule[], bypassList: string = 'LOCAL_BYPASS'): ManglePlacementAnalysis {
    let bypassCount = 0;
    let dedicatedCount = 0;
    let pccCount = 0;
    const validationErrors: string[] = [];

    for (const rule of existingRules) {
      if (this.isBypassRule(rule, bypassList)) {
        bypassCount++;
      } else if (this.isPccRule(rule)) {
        pccCount++;
      } else if (this.isDedicatedRoutingRule(rule)) {
        dedicatedCount++;
      }
    }

    // Check whether Hairpin NAT bypass is placed at index 0
    if (existingRules.length > 0) {
      const firstRule = existingRules[0];
      const hasDstNatBypass = firstRule && firstRule['connection-nat-state'] === 'dstnat';
      if (!hasDstNatBypass) {
        const foundIndex = existingRules.findIndex((r) => r['connection-nat-state'] === 'dstnat');
        if (foundIndex > 0) {
          validationErrors.push(`Hairpin NAT bypass is currently at index ${foundIndex}, but must be at index 0 to avoid misrouting forwarded ports.`);
        }
      }
    }

    // Recommended position for dedicated client routing rule: right after bypass rules and before PCC
    const recommendedIndex = bypassCount + dedicatedCount;

    return {
      recommendedIndex,
      totalRules: existingRules.length,
      bypassCount,
      dedicatedCount,
      pccCount,
      validationErrors,
    };
  }
}
