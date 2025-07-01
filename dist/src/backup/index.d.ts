import { Storage } from '../storage';
import { Config } from '../types';
export interface BackupConfig {
    enabled: boolean;
    schedule: string;
    retention_days: number;
    compression: boolean;
    destination: string;
    include_logs: boolean;
    include_metrics: boolean;
}
export interface BackupResult {
    id: string;
    timestamp: Date;
    size: number;
    compressed_size?: number;
    file_path: string;
    success: boolean;
    error?: string;
    duration: number;
}
export declare class BackupManager {
    private storage;
    private config;
    private backupConfig;
    constructor(storage: Storage, config: Config);
    createBackup(): Promise<BackupResult>;
    private backupDatabase;
    private backupConfiguration;
    private backupMetrics;
    private createManifest;
    private compressBackup;
    private cleanupOldBackups;
    restoreBackup(backupPath: string): Promise<boolean>;
    private extractBackup;
    listBackups(): Promise<BackupResult[]>;
    private calculateDirectorySize;
    private calculateChecksum;
    private formatBytes;
    getConfig(): BackupConfig;
    updateConfig(config: Partial<BackupConfig>): void;
}
//# sourceMappingURL=index.d.ts.map