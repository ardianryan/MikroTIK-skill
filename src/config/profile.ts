import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

export const RouterConfigSchema = z.object({
  host: z.string().min(1, 'Host cannot be empty'),
  user: z.string().min(1, 'User cannot be empty'),
  password: z.string(),
  restPort: z.number().int().positive().default(443),
  useSsl: z.boolean().default(true),
  apiPort: z.number().int().positive().default(8728),
  apiSslPort: z.number().int().positive().default(8729),
  preferBinary: z.boolean().default(false),
  watchdogTimeout: z.number().int().min(10).max(300).default(30),
  wanPrimaryTable: z.string().default('to_ISP1'),
  wanSecondaryTable: z.string().default('to_ISP2'),
  localBypassList: z.string().default('LOCAL_BYPASS'),
});

export type RouterConfig = z.infer<typeof RouterConfigSchema>;

export function loadRouterConfig(overrides?: Partial<RouterConfig>): RouterConfig {
  const envHost = process.env.ROUTEROS_HOST || '192.168.88.1';
  const envUser = process.env.ROUTEROS_USER || 'admin';
  const envPass = process.env.ROUTEROS_PASSWORD || '';
  const envRestPort = process.env.ROUTEROS_REST_PORT ? parseInt(process.env.ROUTEROS_REST_PORT, 10) : 443;
  const envUseSsl = process.env.ROUTEROS_USE_SSL !== 'false';
  const envApiPort = process.env.ROUTEROS_API_PORT ? parseInt(process.env.ROUTEROS_API_PORT, 10) : 8728;
  const envApiSslPort = process.env.ROUTEROS_API_SSL_PORT ? parseInt(process.env.ROUTEROS_API_SSL_PORT, 10) : 8729;
  const envPreferBinary = process.env.ROUTEROS_PREFER_BINARY === 'true';
  const envWatchdogTimeout = process.env.ROUTEROS_WATCHDOG_TIMEOUT ? parseInt(process.env.ROUTEROS_WATCHDOG_TIMEOUT, 10) : 30;
  const envWanPrimary = process.env.WAN_PRIMARY_TABLE || 'to_ISP1';
  const envWanSecondary = process.env.WAN_SECONDARY_TABLE || 'to_ISP2';
  const envLocalBypass = process.env.LOCAL_BYPASS_LIST || 'LOCAL_BYPASS';

  const rawConfig = {
    host: envHost,
    user: envUser,
    password: envPass,
    restPort: envRestPort,
    useSsl: envUseSsl,
    apiPort: envApiPort,
    apiSslPort: envApiSslPort,
    preferBinary: envPreferBinary,
    watchdogTimeout: envWatchdogTimeout,
    wanPrimaryTable: envWanPrimary,
    wanSecondaryTable: envWanSecondary,
    localBypassList: envLocalBypass,
    ...overrides,
  };

  return RouterConfigSchema.parse(rawConfig);
}

export function sanitizeConfig(cfg: RouterConfig): Omit<RouterConfig, 'password'> & { password: string } {
  return {
    ...cfg,
    password: cfg.password ? '********' : '(none)',
  };
}

const PROFILES_DIR = path.join(os.homedir(), '.mtik');
const PROFILES_FILE = path.join(PROFILES_DIR, 'profiles.json');

export interface ProfilesStore {
  activeProfile?: string;
  profiles: Record<string, RouterConfig>;
}

export function loadProfilesStore(): ProfilesStore {
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      const content = fs.readFileSync(PROFILES_FILE, 'utf-8');
      return JSON.parse(content) as ProfilesStore;
    }
  } catch {
    // Return default empty store if unreadable
  }
  return { profiles: {} };
}

export function saveProfilesStore(store: ProfilesStore): void {
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(store, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

export function saveProfile(name: string, config: RouterConfig, setActive: boolean = false): void {
  const store = loadProfilesStore();
  store.profiles[name] = config;
  if (setActive || !store.activeProfile) {
    store.activeProfile = name;
  }
  saveProfilesStore(store);
}

export function getProfile(name?: string): RouterConfig | null {
  const store = loadProfilesStore();
  const targetName = name || store.activeProfile;
  if (targetName && store.profiles[targetName]) {
    return store.profiles[targetName] || null;
  }
  return null;
}

export function setActiveProfile(name: string): boolean {
  const store = loadProfilesStore();
  if (store.profiles[name]) {
    store.activeProfile = name;
    saveProfilesStore(store);
    return true;
  }
  return false;
}

export function listProfiles(): { name: string; active: boolean; host: string; user: string }[] {
  const store = loadProfilesStore();
  return Object.entries(store.profiles).map(([name, cfg]) => ({
    name,
    active: name === store.activeProfile,
    host: cfg.host,
    user: cfg.user,
  }));
}

