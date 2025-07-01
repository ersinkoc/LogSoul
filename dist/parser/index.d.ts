import { LogEntry, LogFormat } from '../types';
export declare class LogParser {
    private formats;
    constructor();
    private initializeFormats;
    parseFile(filePath: string, domainId: number, maxLines?: number): Promise<LogEntry[]>;
    parseLine(line: string, domainId: number, format: LogFormat): LogEntry | null;
    private parseJsonLine;
    private parseTimestamp;
    private detectFormat;
    streamFile(filePath: string, domainId: number, fromPosition?: number): AsyncGenerator<LogEntry>;
    getAvailableFormats(): string[];
    addCustomFormat(name: string, pattern: RegExp, fields: string[]): void;
}
//# sourceMappingURL=index.d.ts.map