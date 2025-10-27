import * as chokidar from 'chokidar';
import * as fs from 'fs';
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

export class FileMonitor extends EventEmitter {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private filePositions: Map<string, number> = new Map();
  private parser: LogParser;
  private storage: Storage;
  private config: Config;
  private isRunning: boolean = false;

  constructor(parser: LogParser, storage: Storage, config: Config) {
    super();
    this.parser = parser;
    this.storage = storage;
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('FileMonitor is already running');
      return;
    }

    this.isRunning = true;
    console.log('🔍 Starting file monitor...');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    for (const [path, watcher] of this.watchers) {
      await watcher.close();
    }
    
    this.watchers.clear();
    this.filePositions.clear();
    console.log('⏹️  File monitor stopped');
  }

  async watchFile(logFile: LogFile): Promise<void> {
    if (this.watchers.has(logFile.path)) {
      console.warn(`Already watching ${logFile.path}`);
      return;
    }

    try {
      const stats = fs.statSync(logFile.path);
      this.filePositions.set(logFile.path, stats.size);

      const watcher = chokidar.watch(logFile.path, {
        persistent: true,
        usePolling: false,
        ignoreInitial: true
      });

      watcher.on('change', async () => {
        await this.handleFileChange(logFile);
      });

      watcher.on('unlink', () => {
        this.handleFileRemoved(logFile.path);
      });

      watcher.on('error', (error) => {
        this.emit('error', error, logFile.path);
      });

      this.watchers.set(logFile.path, watcher);
      console.log(`👀 Now watching: ${logFile.path}`);
      
      this.emit('file-added', logFile.path);
    } catch (error) {
      this.emit('error', new Error(`Failed to watch ${logFile.path}: ${error}`), logFile.path);
    }
  }

  async unwatchFile(filePath: string): Promise<void> {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(filePath);
      this.filePositions.delete(filePath);
      console.log(`🚫 Stopped watching: ${filePath}`);
    }
  }

  private async handleFileChange(logFile: LogFile): Promise<void> {
    try {
      let currentPosition = this.filePositions.get(logFile.path) || 0;
      const stats = fs.statSync(logFile.path);
      
      if (stats.size < currentPosition) {
        console.log(`📄 File rotated: ${logFile.path}`);
        this.filePositions.set(logFile.path, 0);
        currentPosition = 0;
      }

      if (stats.size === currentPosition) {
        return;
      }

      const domain = await this.storage.getDomain(logFile.domain);
      if (!domain) {
        console.warn(`Domain not found: ${logFile.domain}`);
        return;
      }

      const newBytes = stats.size - currentPosition;
      if (newBytes > this.parseSize(this.config.monitoring.max_file_size)) {
        console.warn(`File change too large, skipping: ${logFile.path} (${this.formatBytes(newBytes)})`);
        this.filePositions.set(logFile.path, stats.size);
        return;
      }

      const entries = await this.readNewLines(logFile, currentPosition, domain.id);
      
      if (entries.length > 0) {
        await this.storage.insertLogs(entries);
        await this.storage.updateDomainLastSeen(domain.id);
        
        for (const entry of entries) {
          this.emit('log-entry', entry);
        }
      }

      this.filePositions.set(logFile.path, stats.size);
    } catch (error) {
      this.emit('error', new Error(`Error processing file change: ${error}`), logFile.path);
    }
  }

  private async readNewLines(logFile: LogFile, startPosition: number, domainId: number): Promise<LogEntry[]> {
    const entries: LogEntry[] = [];
    
    const stream = fs.createReadStream(logFile.path, { 
      start: startPosition,
      encoding: 'utf8'
    });

    let buffer = '';
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const entry = this.parser.parseLine(line, domainId, logFile.format);
              if (entry) {
                entries.push(entry);
              }
            } catch (error) {
              console.warn(`Failed to parse line: ${line.substring(0, 100)}...`);
            }
          }
        }
      });

      stream.on('end', () => {
        if (buffer.trim()) {
          try {
            const entry = this.parser.parseLine(buffer, domainId, logFile.format);
            if (entry) {
              entries.push(entry);
            }
          } catch (error) {
            console.warn(`Failed to parse final line: ${buffer.substring(0, 100)}...`);
          }
        }
        resolve(entries);
      });

      stream.on('error', reject);
    });
  }

  private handleFileRemoved(filePath: string): void {
    console.log(`🗑️  File removed: ${filePath}`);
    this.unwatchFile(filePath);
    this.emit('file-removed', filePath);
  }

  async watchDomain(domainName: string, logFiles: LogFile[]): Promise<void> {
    console.log(`🌐 Starting to watch domain: ${domainName} (${logFiles.length} files)`);
    
    for (const logFile of logFiles) {
      await this.watchFile(logFile);
    }
  }

  async unwatchDomain(domainName: string, logFiles: LogFile[]): Promise<void> {
    console.log(`🚫 Stopping watch for domain: ${domainName}`);
    
    for (const logFile of logFiles) {
      await this.unwatchFile(logFile.path);
    }
  }

  getWatchedFiles(): string[] {
    return Array.from(this.watchers.keys());
  }

  isWatching(filePath: string): boolean {
    return this.watchers.has(filePath);
  }

  async tailFile(filePath: string, lines: number = 100): Promise<string[]> {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const allLines = data.split('\n');
      return allLines.slice(-lines).filter(line => line.trim());
    } catch (error) {
      throw new Error(`Failed to tail file ${filePath}: ${error}`);
    }
  }

  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(.*)/);
    if (!match) return 0;
    
    const [, numStr, unit] = match;
    const num = parseFloat(numStr);
    
    switch (unit.toLowerCase()) {
      case 'gb': return num * 1024 * 1024 * 1024;
      case 'mb': return num * 1024 * 1024;
      case 'kb': return num * 1024;
      default: return num;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getStats(): any {
    return {
      watchedFiles: this.watchers.size,
      filePositions: Object.fromEntries(this.filePositions),
      isRunning: this.isRunning
    };
  }
}