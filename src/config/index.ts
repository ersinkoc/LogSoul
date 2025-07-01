import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { EventEmitter } from 'events';
import { Config } from '../types';
import { i18n } from '../i18n';

export interface ConfigValidationRule {
  path: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  validator?: (value: any) => boolean | string;
}

export interface ConfigChangeEvent {
  path: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

export class ConfigManager extends EventEmitter {
  private config!: Config;
  private configPath: string;
  private validationRules: ConfigValidationRule[] = [];
  private watchers: fs.FSWatcher[] = [];
  private changeHistory: ConfigChangeEvent[] = [];

  constructor(configPath: string) {
    super();
    this.configPath = configPath;
    this.setupValidationRules();
    this.loadConfig();
    this.watchConfigFile();
  }

  private setupValidationRules(): void {
    this.validationRules = [
      // Server configuration
      { path: 'server.port', type: 'number', required: true, min: 1, max: 65535 },
      { path: 'server.host', type: 'string', required: true },

      // Storage configuration
      { path: 'storage.db_path', type: 'string', required: true },
      { path: 'storage.retention_days', type: 'number', required: true, min: 1, max: 365 },

      // Monitoring configuration
      { path: 'monitoring.scan_interval', type: 'string', required: true, pattern: /^\d+[smhd]$/ },
      { path: 'monitoring.batch_size', type: 'number', required: true, min: 100, max: 10000 },
      { path: 'monitoring.max_file_size', type: 'string', required: true, pattern: /^\d+[KMGT]?B$/i },

      // Alert configuration
      { path: 'alerts.email.enabled', type: 'boolean', required: true },
      { path: 'alerts.email.smtp_server', type: 'string', required: false },
      { path: 'alerts.webhook.enabled', type: 'boolean', required: true },
      { path: 'alerts.webhook.url', type: 'string', required: false },

      // Log paths
      { path: 'log_paths', type: 'array', required: true },
      { path: 'ignore_patterns', type: 'array', required: true },
      { path: 'panel_paths', type: 'object', required: true }
    ];
  }

  private loadConfig(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        console.log(`📄 Config file not found, creating default: ${this.configPath}`);
        this.config = this.getDefaultConfig();
        this.saveConfig();
        return;
      }

      const configContent = fs.readFileSync(this.configPath, 'utf8');
      this.config = yaml.load(configContent) as Config;
      
      // Validate configuration
      const validation = this.validateConfig(this.config);
      if (!validation.valid) {
        console.error('❌ Configuration validation failed:');
        validation.errors.forEach(error => console.error(`  - ${error}`));
        throw new Error('Invalid configuration');
      }

      console.log(`📄 Configuration loaded from: ${this.configPath}`);
      
    } catch (error) {
      console.error(`❌ Failed to load configuration: ${error}`);
      console.log('📄 Using default configuration');
      this.config = this.getDefaultConfig();
    }
  }

  private saveConfig(): void {
    try {
      const configContent = yaml.dump(this.config, { 
        indent: 2,
        lineWidth: -1,
        noRefs: true 
      });
      
      fs.writeFileSync(this.configPath, configContent, 'utf8');
      console.log(`💾 Configuration saved to: ${this.configPath}`);
      
    } catch (error) {
      console.error(`❌ Failed to save configuration: ${error}`);
    }
  }

  private watchConfigFile(): void {
    try {
      const watcher = fs.watch(this.configPath, (eventType) => {
        if (eventType === 'change') {
          console.log('📄 Configuration file changed, reloading...');
          this.reloadConfig();
        }
      });

      this.watchers.push(watcher);
      console.log(`👁️  Watching configuration file: ${this.configPath}`);
      
    } catch (error) {
      console.warn(`⚠️  Could not watch configuration file: ${error}`);
    }
  }

  private reloadConfig(): void {
    try {
      const oldConfig = JSON.parse(JSON.stringify(this.config));
      this.loadConfig();
      
      // Emit change events for modified values
      this.detectChanges(oldConfig, this.config, '');
      
      this.emit('config:reloaded', this.config);
      
    } catch (error) {
      console.error(`❌ Failed to reload configuration: ${error}`);
    }
  }

  private detectChanges(oldObj: any, newObj: any, basePath: string): void {
    for (const key in newObj) {
      const currentPath = basePath ? `${basePath}.${key}` : key;
      const oldValue = oldObj?.[key];
      const newValue = newObj[key];

      if (typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue)) {
        this.detectChanges(oldValue, newValue, currentPath);
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        const changeEvent: ConfigChangeEvent = {
          path: currentPath,
          oldValue,
          newValue,
          timestamp: new Date()
        };

        this.changeHistory.push(changeEvent);
        
        // Keep only last 100 changes
        if (this.changeHistory.length > 100) {
          this.changeHistory.shift();
        }

        console.log(`🔄 Config changed: ${currentPath} = ${JSON.stringify(newValue)}`);
        this.emit('config:changed', changeEvent);
      }
    }
  }

  validateConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const rule of this.validationRules) {
      const value = this.getNestedValue(config, rule.path);
      const validation = this.validateValue(value, rule);
      
      if (validation !== true) {
        errors.push(`${rule.path}: ${validation}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateValue(value: any, rule: ConfigValidationRule): true | string {
    // Check required
    if (rule.required && (value === undefined || value === null)) {
      return 'is required';
    }

    // Skip validation if value is undefined and not required
    if (value === undefined || value === null) {
      return true;
    }

    // Check type
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rule.type) {
      return `expected ${rule.type}, got ${actualType}`;
    }

    // Type-specific validations
    switch (rule.type) {
      case 'number':
        if (rule.min !== undefined && value < rule.min) {
          return `must be >= ${rule.min}`;
        }
        if (rule.max !== undefined && value > rule.max) {
          return `must be <= ${rule.max}`;
        }
        break;

      case 'string':
        if (rule.pattern && !rule.pattern.test(value)) {
          return `does not match required pattern`;
        }
        break;

      case 'array':
        if (rule.min !== undefined && value.length < rule.min) {
          return `must have at least ${rule.min} items`;
        }
        if (rule.max !== undefined && value.length > rule.max) {
          return `must have at most ${rule.max} items`;
        }
        break;
    }

    // Check enum
    if (rule.enum && !rule.enum.includes(value)) {
      return `must be one of: ${rule.enum.join(', ')}`;
    }

    // Custom validator
    if (rule.validator) {
      const result = rule.validator(value);
      if (result !== true) {
        return typeof result === 'string' ? result : 'custom validation failed';
      }
    }

    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }

  private getDefaultConfig(): Config {
    return {
      server: { port: 9000, host: "0.0.0.0" },
      storage: { db_path: "./logsoul.db", retention_days: 30 },
      monitoring: { scan_interval: "60s", batch_size: 1000, max_file_size: "1GB" },
      alerts: { 
        email: { enabled: false, smtp_server: "" }, 
        webhook: { enabled: false, url: "" } 
      },
      log_paths: ["/var/log/nginx", "/var/log/apache2", "/var/www/vhosts", "/home/*/logs", "/var/www/html"],
      ignore_patterns: ["health-check", "monitoring/ping", "favicon.ico", "robots.txt"],
      panel_paths: {
        plesk: "/var/www/vhosts/{domain}/logs/",
        cpanel: "/home/{user}/logs/",
        directadmin: "/var/log/httpd/domains/"
      }
    };
  }

  // Public API
  getConfig(): Config {
    return JSON.parse(JSON.stringify(this.config)); // Deep clone
  }

  get<T>(path: string): T {
    return this.getNestedValue(this.config, path);
  }

  set(path: string, value: any): boolean {
    try {
      // Validate the change
      const tempConfig = JSON.parse(JSON.stringify(this.config));
      this.setNestedValue(tempConfig, path, value);
      
      const validation = this.validateConfig(tempConfig);
      if (!validation.valid) {
        console.error('❌ Configuration validation failed:', validation.errors);
        return false;
      }

      // Apply the change
      const oldValue = this.getNestedValue(this.config, path);
      this.setNestedValue(this.config, path, value);
      
      // Record change
      const changeEvent: ConfigChangeEvent = {
        path,
        oldValue,
        newValue: value,
        timestamp: new Date()
      };

      this.changeHistory.push(changeEvent);
      
      // Save to file
      this.saveConfig();
      
      console.log(`✅ Configuration updated: ${path} = ${JSON.stringify(value)}`);
      this.emit('config:changed', changeEvent);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to update configuration: ${error}`);
      return false;
    }
  }

  reset(): void {
    console.log('🔄 Resetting configuration to defaults');
    this.config = this.getDefaultConfig();
    this.saveConfig();
    this.emit('config:reset', this.config);
  }

  getChangeHistory(): ConfigChangeEvent[] {
    return [...this.changeHistory];
  }

  exportConfig(): string {
    return yaml.dump(this.config, { indent: 2, lineWidth: -1, noRefs: true });
  }

  importConfig(configString: string): boolean {
    try {
      const newConfig = yaml.load(configString) as Config;
      
      const validation = this.validateConfig(newConfig);
      if (!validation.valid) {
        console.error('❌ Imported configuration is invalid:', validation.errors);
        return false;
      }

      this.config = newConfig;
      this.saveConfig();
      
      console.log('✅ Configuration imported successfully');
      this.emit('config:imported', this.config);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to import configuration: ${error}`);
      return false;
    }
  }

  addValidationRule(rule: ConfigValidationRule): void {
    this.validationRules.push(rule);
  }

  removeValidationRule(path: string): void {
    this.validationRules = this.validationRules.filter(rule => rule.path !== path);
  }

  destroy(): void {
    // Clean up watchers
    this.watchers.forEach(watcher => watcher.close());
    this.watchers = [];
    
    // Clear event listeners
    this.removeAllListeners();
    
    console.log('🧹 ConfigManager destroyed');
  }
}