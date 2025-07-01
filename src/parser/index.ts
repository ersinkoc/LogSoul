import * as fs from 'fs';
import * as readline from 'readline';
import { LogEntry, LogFormat } from '../types';
import moment from 'moment';

export class LogParser {
  private formats: Map<string, LogFormat> = new Map();

  constructor() {
    this.initializeFormats();
  }

  private initializeFormats(): void {
    this.formats.set('nginx_combined', {
      name: 'nginx_combined',
      pattern: /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*)" (\d+) (\d+) "([^"]*)" "([^"]*)".*$/,
      fields: ['ip', 'timestamp', 'method', 'path', 'status', 'size', 'referer', 'user_agent']
    });

    this.formats.set('apache_combined', {
      name: 'apache_combined',
      pattern: /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*)" (\d+) (\d+) "([^"]*)" "([^"]*)"$/,
      fields: ['ip', 'timestamp', 'method', 'path', 'status', 'size', 'referer', 'user_agent']
    });

    this.formats.set('apache_common', {
      name: 'apache_common',
      pattern: /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*)" (\d+) (\d+)$/,
      fields: ['ip', 'timestamp', 'method', 'path', 'status', 'size']
    });

    this.formats.set('nginx_error', {
      name: 'nginx_error',
      pattern: /^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (\d+)#(\d+): (.+)$/,
      fields: ['timestamp', 'level', 'pid', 'tid', 'message']
    });

    this.formats.set('json', {
      name: 'json',
      pattern: /^{.+}$/,
      fields: ['json']
    });
  }

  async parseFile(filePath: string, domainId: number, maxLines: number = 10000): Promise<LogEntry[]> {
    const entries: LogEntry[] = [];
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const format = this.detectFormat(filePath);
    if (!format) {
      throw new Error(`Could not detect log format for: ${filePath}`);
    }

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineCount = 0;

    for await (const line of rl) {
      if (lineCount >= maxLines) {
        break;
      }

      const entry = this.parseLine(line, domainId, format);
      if (entry) {
        entries.push(entry);
      }
      
      lineCount++;
    }

    rl.close();
    return entries;
  }

  parseLine(line: string, domainId: number, format: LogFormat): LogEntry | null {
    if (!line.trim()) {
      return null;
    }

    try {
      if (format.name === 'json') {
        return this.parseJsonLine(line, domainId);
      }

      const match = line.match(format.pattern);
      if (!match) {
        return null;
      }

      const entry: Partial<LogEntry> = {
        domain_id: domainId,
        raw_line: line
      };

      for (let i = 0; i < format.fields.length; i++) {
        const field = format.fields[i];
        const value = match[i + 1];

        switch (field) {
          case 'ip':
            entry.ip = value;
            break;
          case 'timestamp':
            entry.timestamp = this.parseTimestamp(value);
            break;
          case 'method':
            entry.method = value;
            break;
          case 'path':
            entry.path = value;
            break;
          case 'status':
            entry.status = parseInt(value) || 0;
            break;
          case 'size':
            entry.size = parseInt(value) || 0;
            break;
          case 'user_agent':
            entry.user_agent = value;
            break;
          case 'referer':
            entry.referer = value;
            break;
        }
      }

      if (!entry.timestamp) {
        entry.timestamp = new Date();
      }

      return entry as LogEntry;
    } catch (error) {
      console.warn(`Failed to parse line: ${line.substring(0, 100)}...`);
      return null;
    }
  }

  private parseJsonLine(line: string, domainId: number): LogEntry | null {
    try {
      const json = JSON.parse(line);
      
      return {
        domain_id: domainId,
        timestamp: new Date(json.timestamp || json.time || json['@timestamp'] || Date.now()),
        ip: json.ip || json.remote_addr || json.client_ip || 'unknown',
        method: json.method || json.request_method || 'GET',
        path: json.path || json.request_uri || json.url || '/',
        status: parseInt(json.status || json.response_code || json.code) || 200,
        size: parseInt(json.size || json.bytes_sent || json.response_size) || 0,
        response_time: parseFloat(json.response_time || json.request_time || json.duration) || undefined,
        user_agent: json.user_agent || json.useragent || undefined,
        referer: json.referer || json.referrer || undefined,
        raw_line: line
      };
    } catch (error) {
      return null;
    }
  }

  private parseTimestamp(timestampStr: string): Date {
    const formats = [
      'DD/MMM/YYYY:HH:mm:ss ZZ',
      'YYYY/MM/DD HH:mm:ss',
      'YYYY-MM-DD HH:mm:ss',
      'YYYY-MM-DDTHH:mm:ss.SSSZ',
      'YYYY-MM-DDTHH:mm:ssZ'
    ];

    for (const format of formats) {
      const parsed = moment(timestampStr, format);
      if (parsed.isValid()) {
        return parsed.toDate();
      }
    }

    console.warn(`Could not parse timestamp: ${timestampStr}`);
    return new Date();
  }

  private detectFormat(filePath: string): LogFormat | null {
    try {
      const sample = fs.readFileSync(filePath, 'utf8').split('\n').slice(0, 10);
      
      for (const line of sample) {
        if (!line.trim()) continue;

        if (line.startsWith('{') && line.endsWith('}')) {
          return this.formats.get('json')!;
        }

        for (const [, format] of this.formats) {
          if (format.name === 'json') continue;
          
          if (format.pattern.test(line)) {
            return format;
          }
        }
      }

      return this.formats.get('nginx_combined')!;
    } catch (error) {
      console.warn(`Error detecting format for ${filePath}:`, error);
      return this.formats.get('nginx_combined')!;
    }
  }

  async *streamFile(filePath: string, domainId: number, fromPosition: number = 0): AsyncGenerator<LogEntry> {
    const fileStream = fs.createReadStream(filePath, { start: fromPosition });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const format = this.detectFormat(filePath);
    if (!format) {
      throw new Error(`Could not detect log format for: ${filePath}`);
    }

    for await (const line of rl) {
      const entry = this.parseLine(line, domainId, format);
      if (entry) {
        yield entry;
      }
    }

    rl.close();
  }

  getAvailableFormats(): string[] {
    return Array.from(this.formats.keys());
  }

  addCustomFormat(name: string, pattern: RegExp, fields: string[]): void {
    this.formats.set(name, {
      name,
      pattern,
      fields
    });
  }
}