import type { ConnectionManager } from '../client/connection-manager.js';

export interface WatchdogSession {
  schedulerName: string;
  timeoutSeconds: number;
  armedAt: number;
  disarmed: boolean;
}

export class SafeModeWatchdog {
  private conn: ConnectionManager;
  private currentSession: WatchdogSession | null = null;

  constructor(conn: ConnectionManager) {
    this.conn = conn;
  }

  async arm(rollbackCommand: string, timeoutSeconds: number = 30): Promise<WatchdogSession> {
    const schedulerName = `mtik_watchdog_${Date.now()}`;
    const intervalStr = `${timeoutSeconds}s`;

    // Script removes itself after executing rollback command
    const scriptBody = `${rollbackCommand}; /system/scheduler/remove [find name="${schedulerName}"]`;

    await this.conn.addScheduler(schedulerName, intervalStr, scriptBody);

    this.currentSession = {
      schedulerName,
      timeoutSeconds,
      armedAt: Date.now(),
      disarmed: false,
    };

    return this.currentSession;
  }

  async disarm(): Promise<boolean> {
    if (!this.currentSession || this.currentSession.disarmed) {
      return false;
    }

    try {
      await this.conn.removeScheduler(this.currentSession.schedulerName);
      this.currentSession.disarmed = true;
      return true;
    } catch {
      return false;
    }
  }

  getSession(): WatchdogSession | null {
    return this.currentSession;
  }
}
