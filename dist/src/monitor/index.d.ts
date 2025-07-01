import { EventEmitter } from 'events';
import { LogParser } from '../parser';
import { Storage } from '../storage';
import { LogEntry, LogFile, Config } from '../types';
export interface FileMonitorEvents {
    'log-entry': (entry: LogEntry) => void;
    'error': (error: Error, file: string) => void;
    'file-added': (file: string) => void;
    'file-removed': (file: string) => void;
}
export declare class FileMonitor extends EventEmitter {
    private watchers;
    private filePositions;
    private parser;
    private storage;
    private config;
    private isRunning;
    constructor(parser: LogParser, storage: Storage, config: Config);
    start(): Promise<void>;
    stop(): Promise<void>;
    watchFile(logFile: LogFile): Promise<void>;
    unwatchFile(filePath: string): Promise<void>;
    private handleFileChange;
    private readNewLines;
    private handleFileRemoved;
    watchDomain(domainName: string, logFiles: LogFile[]): Promise<void>;
    unwatchDomain(domainName: string, logFiles: LogFile[]): Promise<void>;
    getWatchedFiles(): string[];
    isWatching(filePath: string): boolean;
    tailFile(filePath: string, lines?: number): Promise<string[]>;
    private parseSize;
    private formatBytes;
    getStats(): any;
}
//# sourceMappingURL=index.d.ts.map