import * as sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import { Domain, LogEntry, Alert, DomainStats } from '../types';

export class Storage {
  private db: Database;
  private dbPath: string;

  constructor(dbPath: string = './logsoul.db') {
    this.dbPath = dbPath;
    this.db = new sqlite3.Database(dbPath);
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS domains (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            health_score INTEGER DEFAULT 100
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain_id INTEGER NOT NULL,
            timestamp DATETIME NOT NULL,
            ip TEXT NOT NULL,
            method TEXT,
            path TEXT,
            status INTEGER,
            size INTEGER DEFAULT 0,
            response_time REAL,
            user_agent TEXT,
            referer TEXT,
            raw_line TEXT,
            FOREIGN KEY (domain_id) REFERENCES domains(id)
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS metrics (
            domain_id INTEGER NOT NULL,
            timestamp DATETIME NOT NULL,
            requests INTEGER DEFAULT 0,
            errors INTEGER DEFAULT 0,
            avg_response_time REAL DEFAULT 0,
            bandwidth INTEGER DEFAULT 0,
            unique_ips INTEGER DEFAULT 0,
            PRIMARY KEY (domain_id, timestamp),
            FOREIGN KEY (domain_id) REFERENCES domains(id)
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME,
            FOREIGN KEY (domain_id) REFERENCES domains(id)
          )
        `);

        this.db.run(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_logs_domain_timestamp ON logs(domain_id, timestamp)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_logs_status ON logs(status)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_logs_ip ON logs(ip)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_alerts_domain ON alerts(domain_id)`);

        resolve();
      });
    });
  }

  async addDomain(name: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const self = this;
      this.db.run(
        'INSERT OR IGNORE INTO domains (name) VALUES (?)',
        [name],
        function(err: Error | null) {
          if (err) {
            reject(err);
            return;
          }
          
          if (this.lastID) {
            resolve(this.lastID);
          } else {
            // Domain already exists, get its ID
            self.db.get(
              'SELECT id FROM domains WHERE name = ?',
              [name],
              (err: Error | null, row: any) => {
                if (err) reject(err);
                else resolve(row.id);
              }
            );
          }
        }
      );
    });
  }

  async getDomain(name: string): Promise<Domain | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM domains WHERE name = ?',
        [name],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (row) {
            resolve({
              id: row.id,
              name: row.name,
              created_at: new Date(row.created_at),
              last_seen: new Date(row.last_seen),
              health_score: row.health_score
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  async getDomains(): Promise<Domain[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM domains ORDER BY name',
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const domains = rows.map(row => ({
              id: row.id,
              name: row.name,
              created_at: new Date(row.created_at),
              last_seen: new Date(row.last_seen),
              health_score: row.health_score
            }));
            resolve(domains);
          }
        }
      );
    });
  }

  async insertLogs(logs: LogEntry[]): Promise<void> {
    if (logs.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO logs (domain_id, timestamp, ip, method, path, status, size, response_time, user_agent, referer, raw_line)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        for (const log of logs) {
          stmt.run([
            log.domain_id,
            log.timestamp.toISOString(),
            log.ip,
            log.method,
            log.path,
            log.status,
            log.size,
            log.response_time,
            log.user_agent,
            log.referer,
            log.raw_line
          ]);
        }
        
        this.db.run('COMMIT', (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      stmt.finalize();
    });
  }

  async getLogs(domainId: number, limit: number = 1000, offset: number = 0): Promise<LogEntry[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM logs WHERE domain_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
        [domainId, limit, offset],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const logs = rows.map(row => ({
              id: row.id,
              domain_id: row.domain_id,
              timestamp: new Date(row.timestamp),
              ip: row.ip,
              method: row.method,
              path: row.path,
              status: row.status,
              size: row.size,
              response_time: row.response_time,
              user_agent: row.user_agent,
              referer: row.referer,
              raw_line: row.raw_line
            }));
            resolve(logs);
          }
        }
      );
    });
  }

  async getLogsByTimeRange(domainId: number, startTime: Date, endTime: Date): Promise<LogEntry[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM logs WHERE domain_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
        [domainId, startTime.toISOString(), endTime.toISOString()],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const logs = rows.map(row => ({
              id: row.id,
              domain_id: row.domain_id,
              timestamp: new Date(row.timestamp),
              ip: row.ip,
              method: row.method,
              path: row.path,
              status: row.status,
              size: row.size,
              response_time: row.response_time,
              user_agent: row.user_agent,
              referer: row.referer,
              raw_line: row.raw_line
            }));
            resolve(logs);
          }
        }
      );
    });
  }

  private timeRangeToMinutes(timeRange: string): number {
    const timeRangeMinutes: { [key: string]: number } = {
      '1h': 60,
      '24h': 1440,
      '7d': 10080,
      '30d': 43200
    };
    return timeRangeMinutes[timeRange] || 60;
  }

  async getDomainStats(domainId: number, timeRange: string = '1h'): Promise<DomainStats | null> {
    const timeRangeMap: { [key: string]: string } = {
      '1h': '-1 hour',
      '24h': '-24 hours',
      '7d': '-7 days',
      '30d': '-30 days'
    };

    const timeOffset = timeRangeMap[timeRange] || '-1 hour';

    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT 
          d.name as domain,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN l.status >= 400 THEN 1 END) as error_count,
          AVG(l.response_time) as avg_response_time,
          SUM(l.size) as total_bandwidth,
          COUNT(DISTINCT l.ip) as unique_ips,
          d.health_score
        FROM logs l
        JOIN domains d ON l.domain_id = d.id
        WHERE l.domain_id = ? 
        AND l.timestamp >= datetime('now', ?)
      `, [domainId, timeOffset], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (row && row.total_requests > 0) {
          const stats: DomainStats = {
            domain: row.domain,
            requests_per_minute: row.total_requests / this.timeRangeToMinutes(timeRange),
            error_rate: (row.error_count / row.total_requests) * 100,
            avg_response_time: row.avg_response_time || 0,
            traffic_volume: row.total_bandwidth || 0,
            unique_ips: row.unique_ips || 0,
            health_score: row.health_score || 100
          };
          resolve(stats);
        } else {
          resolve(null);
        }
      });
    });
  }

  async addAlert(domainId: number, type: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical'): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO alerts (domain_id, type, message, severity) VALUES (?, ?, ?, ?)',
        [domainId, type, message, severity],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID!);
          }
        }
      );
    });
  }

  async getAlerts(domainId?: number, limit: number = 100): Promise<Alert[]> {
    const query = domainId 
      ? 'SELECT * FROM alerts WHERE domain_id = ? ORDER BY created_at DESC LIMIT ?'
      : 'SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?';
    
    const params = domainId ? [domainId, limit] : [limit];

    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const alerts = rows.map(row => ({
            id: row.id,
            domain_id: row.domain_id,
            type: row.type,
            message: row.message,
            severity: row.severity as 'low' | 'medium' | 'high' | 'critical',
            created_at: new Date(row.created_at),
            resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined
          }));
          resolve(alerts);
        }
      });
    });
  }

  async updateDomainLastSeen(domainId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE domains SET last_seen = CURRENT_TIMESTAMP WHERE id = ?',
        [domainId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async cleanupOldLogs(retentionDays: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM logs WHERE timestamp < datetime("now", "-" || ? || " days")',
        [retentionDays],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes!);
          }
        }
      );
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}