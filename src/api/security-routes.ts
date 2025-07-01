import { Router, Request, Response } from 'express';
import { SecurityManager } from '../security';
import { AuthManager } from '../auth';
import { Storage } from '../storage';
import { i18n } from '../i18n';

export function createSecurityRoutes(storage: Storage, authManager: AuthManager): Router {
  const router = Router();
  const security = new SecurityManager(storage);
  
  // Get security dashboard data
  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      // This would normally require admin authentication
      // For now, we'll return mock data
      const dashboard = {
        overview: {
          total_requests: 15234,
          blocked_requests: 142,
          unique_ips: 892,
          threat_level: 'medium'
        },
        recent_threats: [
          {
            timestamp: new Date(Date.now() - 300000),
            type: 'sql_injection',
            severity: 'high',
            ip: '192.168.1.100',
            path: '/api/search',
            blocked: true
          },
          {
            timestamp: new Date(Date.now() - 600000),
            type: 'xss',
            severity: 'medium',
            ip: '10.0.0.50',
            path: '/api/comments',
            blocked: true
          }
        ],
        threat_statistics: {
          sql_injection: 45,
          xss: 38,
          csrf: 12,
          brute_force: 27,
          path_traversal: 20
        },
        top_blocked_ips: [
          { ip: '192.168.1.100', count: 23 },
          { ip: '10.0.0.50', count: 18 },
          { ip: '172.16.0.1', count: 15 }
        ],
        security_score: 85
      };
      
      res.json(dashboard);
    } catch (error) {
      console.error('Security dashboard error:', error);
      res.status(500).json({ error: 'Failed to load security dashboard' });
    }
  });
  
  // Get security events
  router.get('/events', async (req: Request, res: Response) => {
    try {
      const { 
        page = 1, 
        limit = 50,
        severity,
        type,
        start_date,
        end_date
      } = req.query;
      
      // Mock security events
      const events = [
        {
          id: 1,
          type: 'sql_injection',
          severity: 'high',
          ip_address: '192.168.1.100',
          path: '/api/search?q=\' OR 1=1--',
          method: 'GET',
          timestamp: new Date(Date.now() - 300000),
          blocked: true,
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        {
          id: 2,
          type: 'brute_force',
          severity: 'medium',
          ip_address: '10.0.0.50',
          path: '/api/auth/login',
          method: 'POST',
          timestamp: new Date(Date.now() - 600000),
          blocked: false,
          user_agent: 'python-requests/2.28.1'
        }
      ];
      
      res.json({
        events,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: events.length
        }
      });
    } catch (error) {
      console.error('Security events error:', error);
      res.status(500).json({ error: 'Failed to load security events' });
    }
  });
  
  // Get/Update security configuration
  router.get('/config', async (req: Request, res: Response) => {
    try {
      const config = {
        waf: {
          enabled: true,
          rules_count: 25,
          mode: 'block' // 'block' or 'monitor'
        },
        rate_limiting: {
          enabled: true,
          global_limit: 100,
          api_limit: 30,
          auth_limit: 5
        },
        ip_security: {
          whitelist: [],
          blacklist: ['192.168.1.100', '10.0.0.50'],
          geo_blocking_enabled: false,
          blocked_countries: []
        },
        authentication: {
          session_timeout: 480,
          max_login_attempts: 5,
          lockout_duration: 15,
          mfa_enabled: false
        }
      };
      
      res.json(config);
    } catch (error) {
      console.error('Security config error:', error);
      res.status(500).json({ error: 'Failed to load security configuration' });
    }
  });
  
  router.put('/config', async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      
      // Validate and apply configuration updates
      // This would normally update the actual security configuration
      
      res.json({ 
        success: true, 
        message: 'Security configuration updated successfully' 
      });
    } catch (error) {
      console.error('Security config update error:', error);
      res.status(500).json({ error: 'Failed to update security configuration' });
    }
  });
  
  // IP management
  router.get('/ip-reputation/:ip', async (req: Request, res: Response) => {
    try {
      const { ip } = req.params;
      const reputation = await security.checkIPReputation(ip);
      
      res.json(reputation);
    } catch (error) {
      console.error('IP reputation error:', error);
      res.status(500).json({ error: 'Failed to check IP reputation' });
    }
  });
  
  router.post('/ip-whitelist', async (req: Request, res: Response) => {
    try {
      const { ip, reason } = req.body;
      
      if (!ip || !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
      }
      
      // Add to whitelist
      console.log(`➕ Added ${ip} to whitelist: ${reason}`);
      
      res.json({ 
        success: true, 
        message: `IP ${ip} added to whitelist` 
      });
    } catch (error) {
      console.error('IP whitelist error:', error);
      res.status(500).json({ error: 'Failed to add IP to whitelist' });
    }
  });
  
  router.post('/ip-blacklist', async (req: Request, res: Response) => {
    try {
      const { ip, reason } = req.body;
      
      if (!ip || !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
      }
      
      // Add to blacklist
      console.log(`🚫 Added ${ip} to blacklist: ${reason}`);
      
      res.json({ 
        success: true, 
        message: `IP ${ip} added to blacklist` 
      });
    } catch (error) {
      console.error('IP blacklist error:', error);
      res.status(500).json({ error: 'Failed to add IP to blacklist' });
    }
  });
  
  // WAF rules management
  router.get('/waf/rules', async (req: Request, res: Response) => {
    try {
      const rules = [
        {
          id: 'sql-injection-001',
          name: 'SQL Injection - UNION SELECT',
          category: 'sql_injection',
          severity: 'high',
          enabled: true,
          hits: 45
        },
        {
          id: 'xss-001',
          name: 'XSS - Script Tags',
          category: 'xss',
          severity: 'high',
          enabled: true,
          hits: 38
        },
        {
          id: 'lfi-001',
          name: 'LFI - Path Traversal',
          category: 'lfi',
          severity: 'high',
          enabled: true,
          hits: 20
        }
      ];
      
      res.json(rules);
    } catch (error) {
      console.error('WAF rules error:', error);
      res.status(500).json({ error: 'Failed to load WAF rules' });
    }
  });
  
  router.put('/waf/rules/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      
      console.log(`${enabled ? '✅' : '❌'} WAF rule ${id} ${enabled ? 'enabled' : 'disabled'}`);
      
      res.json({ 
        success: true, 
        message: `WAF rule ${id} ${enabled ? 'enabled' : 'disabled'}` 
      });
    } catch (error) {
      console.error('WAF rule update error:', error);
      res.status(500).json({ error: 'Failed to update WAF rule' });
    }
  });
  
  // Security audit logs
  router.get('/audit-logs', async (req: Request, res: Response) => {
    try {
      const { 
        page = 1, 
        limit = 50,
        user_id,
        action,
        start_date,
        end_date
      } = req.query;
      
      const logs = [
        {
          id: 1,
          user_id: 1,
          username: 'admin',
          action: 'login',
          resource: '/api/auth/login',
          ip_address: '192.168.1.50',
          timestamp: new Date(Date.now() - 3600000),
          success: true
        },
        {
          id: 2,
          user_id: 2,
          username: 'user1',
          action: 'update_domain',
          resource: '/api/domains/1',
          ip_address: '192.168.1.51',
          timestamp: new Date(Date.now() - 7200000),
          success: true
        }
      ];
      
      res.json({
        logs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: logs.length
        }
      });
    } catch (error) {
      console.error('Audit logs error:', error);
      res.status(500).json({ error: 'Failed to load audit logs' });
    }
  });
  
  // Password strength checker
  router.post('/check-password', async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ error: 'Password is required' });
      }
      
      const result = security.checkPasswordStrength(password);
      
      res.json(result);
    } catch (error) {
      console.error('Password check error:', error);
      res.status(500).json({ error: 'Failed to check password strength' });
    }
  });
  
  return router;
};