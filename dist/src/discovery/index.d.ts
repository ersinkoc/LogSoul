import { LogFile, DiscoveryResult, Config } from '../types';
export declare class LogDiscovery {
    private config;
    private logPatterns;
    private domainPatterns;
    constructor(config: Config);
    discoverLogs(): Promise<DiscoveryResult>;
    private scanPath;
    private analyzeLogFile;
    private extractDomain;
    private detectLogType;
    private detectLogFormat;
    private parseSize;
    private formatBytes;
    findDomainLogs(domain: string): Promise<LogFile[]>;
    listDomains(): Promise<string[]>;
}
//# sourceMappingURL=index.d.ts.map