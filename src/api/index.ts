import express from 'express';
import { createServer as createHTTPServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as path from 'path';
import { Storage } from '../storage';
import { LogDiscovery } from '../discovery';
import { LogParser } from '../parser';
import { FileMonitor } from '../monitor';
import { LogAnalyzer } from '../analyzer';
import { MetricsCollector } from '../metrics';
import { Config, LogEntry } from '../types';
import { createSecurityMiddleware } from '../middleware/security';
import { AuthManager } from '../auth';
import { createSecurityRoutes } from './security-routes';

export function createServer(
  config: Config,
  storage: Storage,
  discovery: LogDiscovery,
  parser: LogParser
): any {
  const app = express();
  const server = createHTTPServer(app);
  const wss = new WebSocketServer({ server });

  const monitor = new FileMonitor(parser, storage, config);
  const analyzer = new LogAnalyzer(storage);
  const metricsCollector = new MetricsCollector(storage, analyzer);
  const authManager = new AuthManager(storage);
  
  // Initialize security middleware
  const security = createSecurityMiddleware({
    storage,
    securityConfig: (config as any).security
  });
  
  // Apply security middleware
  app.use(security.applyAll());
  
  // CORS configuration
  app.use(cors({
    origin: (config as any).security?.cors?.origin || true,
    credentials: true,
    optionsSuccessStatus: 200
  }));
  
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // API-specific rate limiting
  app.use('/api/', security.apiRateLimit());
  app.use('/api/auth/', security.authRateLimit());

  app.use(express.static(path.join(__dirname, '../../web/static')));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../web/templates/index.html'));
  });

  app.get('/api/domains', async (req, res) => {
    try {
      const domains = await storage.getDomains();
      const domainsWithStats = await Promise.all(
        domains.map(async (domain) => {
          const stats = await storage.getDomainStats(domain.id);
          return { ...domain, stats };
        })
      );
      res.json(domainsWithStats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch domains' });
    }
  });

  app.post('/api/domains', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Domain name is required' });
      }
      
      const domainId = await storage.addDomain(name);
      const domain = await storage.getDomain(name);
      res.status(201).json(domain);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add domain' });
    }
  });

  app.get('/api/domains/:domain', async (req, res) => {
    try {
      const { domain: domainName } = req.params;
      const domain = await storage.getDomain(domainName);
      
      if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
      }

      const stats = await storage.getDomainStats(domain.id);
      const alerts = await storage.getAlerts(domain.id, 10);
      const logFiles = await discovery.findDomainLogs(domainName);

      res.json({
        ...domain,
        stats,
        alerts,
        log_files: logFiles
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch domain details' });
    }
  });

  app.get('/api/domains/:domain/logs', async (req, res) => {
    try {
      const { domain: domainName } = req.params;
      const { limit = 1000, offset = 0, start_time, end_time } = req.query;
      
      const domain = await storage.getDomain(domainName);
      if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
      }

      let logs;
      if (start_time && end_time) {
        logs = await storage.getLogsByTimeRange(
          domain.id,
          new Date(start_time as string),
          new Date(end_time as string)
        );
      } else {
        logs = await storage.getLogs(domain.id, Number(limit), Number(offset));
      }

      res.json({
        logs,
        total: logs.length,
        domain: domainName
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  app.get('/api/domains/:domain/stats', async (req, res) => {
    try {
      const { domain: domainName } = req.params;
      const { range = '1h' } = req.query;
      
      const domain = await storage.getDomain(domainName);
      if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
      }

      const stats = await storage.getDomainStats(domain.id, range as string);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch domain statistics' });
    }
  });

  app.get('/api/discovery', async (req, res) => {
    try {
      const result = await discovery.discoverLogs();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to discover logs' });
    }
  });

  app.post('/api/discovery/scan', async (req, res) => {
    try {
      const result = await discovery.discoverLogs();
      
      for (const domain of result.domains) {
        await storage.addDomain(domain);
      }

      res.json({
        message: 'Discovery scan completed',
        domains_found: result.domains.size,
        log_files_found: result.log_files.length,
        errors: result.errors
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to run discovery scan' });
    }
  });

  app.get('/api/alerts', async (req, res) => {
    try {
      const { domain, limit = 100 } = req.query;
      let domainId;
      
      if (domain) {
        const domainObj = await storage.getDomain(domain as string);
        if (!domainObj) {
          return res.status(404).json({ error: 'Domain not found' });
        }
        domainId = domainObj.id;
      }

      const alerts = await storage.getAlerts(domainId, Number(limit));
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  });

  app.post('/api/alerts', async (req, res) => {
    try {
      const { domain, type, message, severity } = req.body;
      
      const domainObj = await storage.getDomain(domain);
      if (!domainObj) {
        return res.status(404).json({ error: 'Domain not found' });
      }

      const alertId = await storage.addAlert(domainObj.id, type, message, severity);
      res.status(201).json({ id: alertId, message: 'Alert created' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create alert' });
    }
  });

  app.get('/api/search', async (req, res) => {
    try {
      const { q, domain, limit = 100 } = req.query;
      
      if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      let domainId;
      if (domain) {
        const domainObj = await storage.getDomain(domain as string);
        if (!domainObj) {
          return res.status(404).json({ error: 'Domain not found' });
        }
        domainId = domainObj.id;
      }

      const logs = await storage.getLogs(domainId || 0, Number(limit));
      const searchTerm = (q as string).toLowerCase();
      
      const filteredLogs = logs.filter(log => 
        log.raw_line.toLowerCase().includes(searchTerm) ||
        log.path.toLowerCase().includes(searchTerm) ||
        log.ip.includes(searchTerm) ||
        (log.user_agent && log.user_agent.toLowerCase().includes(searchTerm))
      );

      res.json({
        query: q,
        results: filteredLogs,
        total: filteredLogs.length
      });
    } catch (error) {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  app.get('/api/monitor/status', (req, res) => {
    res.json(monitor.getStats());
  });

  app.post('/api/monitor/start', async (req, res) => {
    try {
      await monitor.start();
      res.json({ message: 'Monitor started' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to start monitor' });
    }
  });

  app.post('/api/monitor/stop', async (req, res) => {
    try {
      await monitor.stop();
      res.json({ message: 'Monitor stopped' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to stop monitor' });
    }
  });

  // Metrics endpoints
  app.get('/api/metrics', async (req, res) => {
    try {
      const format = req.query.format || 'prometheus';
      
      if (format === 'prometheus') {
        const metrics = await metricsCollector.getPrometheusMetrics();
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(metrics);
      } else if (format === 'json') {
        const metrics = await metricsCollector.getJsonMetrics();
        res.json(metrics);
      } else {
        res.status(400).json({ error: 'Unsupported format. Use "prometheus" or "json"' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to collect metrics' });
    }
  });

  // Security routes
  const securityRoutes = createSecurityRoutes(storage, authManager);
  app.use('/api/security', securityRoutes);
  
  app.get('/api/health', async (req, res) => {
    try {
      const domains = await storage.getDomains();
      const monitorStats = monitor.getStats();
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        domains_monitored: domains.length,
        files_watched: monitorStats.watchedFiles,
        monitor_running: monitorStats.isRunning,
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        version: '1.0.0'
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed'
      });
    }
  });

  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');
    
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const domain = url.searchParams.get('domain');
    
    if (domain) {
      const handleLogEntry = (entry: LogEntry) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'log-entry',
            data: entry
          }));
        }
      };

      monitor.on('log-entry', handleLogEntry);
      
      ws.on('close', () => {
        monitor.removeListener('log-entry', handleLogEntry);
        console.log('WebSocket client disconnected');
      });
    }

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'subscribe':
            if (data.domain) {
              const logFiles = await discovery.findDomainLogs(data.domain);
              await monitor.watchDomain(data.domain, logFiles);
            }
            break;
            
          case 'unsubscribe':
            if (data.domain) {
              const logFiles = await discovery.findDomainLogs(data.domain);
              await monitor.unwatchDomain(data.domain, logFiles);
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to LogSoul real-time stream'
    }));
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return server;
}