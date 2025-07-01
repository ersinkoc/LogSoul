import { Domain, LogEntry, Alert, DomainStats } from '../types';
export declare class Storage {
    private db;
    private dbPath;
    constructor(dbPath?: string);
    private initializeDatabase;
    addDomain(name: string): Promise<number>;
    getDomain(name: string): Promise<Domain | null>;
    getDomains(): Promise<Domain[]>;
    insertLogs(logs: LogEntry[]): Promise<void>;
    getLogs(domainId: number, limit?: number, offset?: number): Promise<LogEntry[]>;
    getLogsByTimeRange(domainId: number, startTime: Date, endTime: Date): Promise<LogEntry[]>;
    getDomainStats(domainId: number, timeRange?: string): Promise<DomainStats | null>;
    addAlert(domainId: number, type: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical'): Promise<number>;
    getAlerts(domainId?: number, limit?: number): Promise<Alert[]>;
    updateDomainLastSeen(domainId: number): Promise<void>;
    cleanupOldLogs(retentionDays: number): Promise<number>;
    close(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map