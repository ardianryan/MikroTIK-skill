import { RouterOSAPI } from 'node-routeros';
import type { RouterConfig } from '../config/profile.js';
import type {
  SystemResource,
  RouterBoard,
  MangleRule,
  DhcpLease,
  RoutingTable,
  FirewallFilterRule,
  IpService,
  NtpClient,
  DnsSettings,
  InterfaceItem,
  ContainerItem,
  AdlistItem,
  InterfaceTrafficMonitor,
} from './types.js';

export class RouterOsBinaryClient {
  private config: RouterConfig;
  private api: RouterOSAPI | null = null;
  private isConnected = false;

  constructor(config: RouterConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.api) {
      return;
    }

    const port = this.config.useSsl ? this.config.apiSslPort : this.config.apiPort;
    this.api = new RouterOSAPI({
      host: this.config.host,
      user: this.config.user,
      password: this.config.password,
      port,
      tls: this.config.useSsl ? { rejectUnauthorized: false } : undefined,
      timeout: 10,
    });

    await this.api.connect();
    this.isConnected = true;
  }

  async close(): Promise<void> {
    if (this.api && this.isConnected) {
      this.api.close();
      this.isConnected = false;
      this.api = null;
    }
  }

  private async writeQuery<T>(command: string, params?: Record<string, string>): Promise<T[]> {
    await this.connect();
    if (!this.api) {
      throw new Error('RouterOS binary API is not connected');
    }

    const commandParts: string[] = [command];
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        commandParts.push(`?${key}=${value}`);
      }
    }

    const result = await this.api.write(commandParts);
    return result as T[];
  }

  async getResource(): Promise<SystemResource> {
    const res = await this.writeQuery<SystemResource>('/system/resource/print');
    return res[0] || {};
  }

  async getRouterBoard(): Promise<RouterBoard> {
    const res = await this.writeQuery<RouterBoard>('/system/routerboard/print');
    return res[0] || {};
  }

  async getMangleRules(): Promise<MangleRule[]> {
    return this.writeQuery<MangleRule>('/ip/firewall/mangle/print');
  }

  async addMangleRule(rule: Partial<MangleRule>): Promise<unknown> {
    await this.connect();
    if (!this.api) throw new Error('Not connected');
    const parts: string[] = ['/ip/firewall/mangle/add'];
    for (const [key, val] of Object.entries(rule)) {
      if (val !== undefined && key !== '.id') {
        parts.push(`=${key}=${val}`);
      }
    }
    return this.api.write(parts);
  }

  async setMangleRule(id: string, patch: Partial<MangleRule>): Promise<unknown> {
    await this.connect();
    if (!this.api) throw new Error('Not connected');
    const parts: string[] = ['/ip/firewall/mangle/set', `numbers=${id}`];
    for (const [key, val] of Object.entries(patch)) {
      if (val !== undefined && key !== '.id') {
        parts.push(`=${key}=${val}`);
      }
    }
    return this.api.write(parts);
  }

  async removeMangleRule(id: string): Promise<unknown> {
    await this.connect();
    if (!this.api) throw new Error('Not connected');
    return this.api.write(['/ip/firewall/mangle/remove', `numbers=${id}`]);
  }

  async getDhcpLeases(): Promise<DhcpLease[]> {
    return this.writeQuery<DhcpLease>('/ip/dhcp-server/lease/print');
  }

  async addDhcpLease(lease: Partial<DhcpLease>): Promise<unknown> {
    await this.connect();
    if (!this.api) throw new Error('Not connected');
    const parts: string[] = ['/ip/dhcp-server/lease/add'];
    for (const [key, val] of Object.entries(lease)) {
      if (val !== undefined && key !== '.id') {
        parts.push(`=${key}=${val}`);
      }
    }
    return this.api.write(parts);
  }

  async getRoutingTables(): Promise<RoutingTable[]> {
    return this.writeQuery<RoutingTable>('/routing/table/print');
  }

  async getFirewallFilters(): Promise<FirewallFilterRule[]> {
    return this.writeQuery<FirewallFilterRule>('/ip/firewall/filter/print');
  }

  async getIpServices(): Promise<IpService[]> {
    return this.writeQuery<IpService>('/ip/service/print');
  }

  async getNtpClient(): Promise<NtpClient> {
    const res = await this.writeQuery<NtpClient>('/system/ntp/client/print');
    return res[0] || {};
  }

  async getDnsSettings(): Promise<DnsSettings> {
    const res = await this.writeQuery<DnsSettings>('/ip/dns/print');
    return res[0] || {};
  }

  async getInterfaces(): Promise<InterfaceItem[]> {
    return this.writeQuery<InterfaceItem>('/interface/print');
  }

  async addScheduler(name: string, interval: string, onEvent: string): Promise<unknown> {
    await this.connect();
    if (!this.api) throw new Error('Not connected');
    return this.api.write([
      '/system/scheduler/add',
      `=name=${name}`,
      `=interval=${interval}`,
      `=on-event=${onEvent}`,
    ]);
  }

  async removeScheduler(name: string): Promise<unknown> {
    await this.connect();
    if (!this.api) throw new Error('Not connected');
    return this.api.write(['/system/scheduler/remove', `numbers=${name}`]);
  }

  async getContainers(): Promise<ContainerItem[]> {
    return this.writeQuery<ContainerItem>('/container/print');
  }

  async restartContainer(nameOrId: string): Promise<unknown> {
    await this.connect();
    if (!this.api) throw new Error('Not connected');
    await this.api.write(['/container/stop', `numbers=${nameOrId}`]);
    return this.api.write(['/container/start', `numbers=${nameOrId}`]);
  }

  async getDnsAdlists(): Promise<AdlistItem[]> {
    return this.writeQuery<AdlistItem>('/ip/dns/adlist/print');
  }

  async addDnsAdlist(url: string, sslVerify: boolean = false): Promise<unknown> {
    await this.connect();
    if (!this.api) throw new Error('Not connected');
    return this.api.write([
      '/ip/dns/adlist/add',
      `=url=${url}`,
      `=ssl-verify=${sslVerify ? 'yes' : 'no'}`,
    ]);
  }

  async getInterfaceTraffic(interfaceName: string): Promise<InterfaceTrafficMonitor> {
    await this.connect();
    if (!this.api) throw new Error('Not connected');
    const res = await this.api.write([
      '/interface/monitor-traffic',
      `=interface=${interfaceName}`,
      '=once=',
    ]);
    const row = res[0] as InterfaceTrafficMonitor | undefined;
    return row || { name: interfaceName };
  }
}
