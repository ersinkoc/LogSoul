import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { LogEntry, Domain, Alert } from '../types';

export interface Plugin {
  name: string;
  version: string;
  description: string;
  author: string;
  
  // Lifecycle hooks
  onLoad?(): Promise<void>;
  onUnload?(): Promise<void>;
  
  // Event handlers
  onLogEntry?(entry: LogEntry): Promise<void>;
  onDomainAdded?(domain: Domain): Promise<void>;
  onAlert?(alert: Alert): Promise<void>;
  
  // Data processors
  processLogLine?(line: string, domain: string): Promise<LogEntry | null>;
  analyzeTraffic?(entries: LogEntry[]): Promise<any>;
  
  // Custom routes
  getRoutes?(): Array<{ method: string; path: string; handler: Function }>;
  
  // Configuration
  getConfig?(): any;
  setConfig?(config: any): Promise<void>;
}

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  dependencies?: string[];
  logsoul_version: string;
}

export class PluginManager extends EventEmitter {
  private plugins: Map<string, Plugin> = new Map();
  private pluginPaths: Map<string, string> = new Map();
  private pluginsDir: string;

  constructor(pluginsDir: string = './plugins') {
    super();
    this.pluginsDir = pluginsDir;
    this.ensurePluginsDirectory();
  }

  private ensurePluginsDirectory(): void {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
      console.log(`📁 Created plugins directory: ${this.pluginsDir}`);
    }
  }

  async loadPlugin(pluginPath: string): Promise<boolean> {
    try {
      console.log(`🔌 Loading plugin from: ${pluginPath}`);

      // Read plugin metadata
      const packagePath = path.join(pluginPath, 'package.json');
      if (!fs.existsSync(packagePath)) {
        throw new Error('Plugin package.json not found');
      }

      const metadata: PluginMetadata = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // Validate plugin
      this.validatePlugin(metadata);

      // Check if plugin already loaded
      if (this.plugins.has(metadata.name)) {
        console.warn(`⚠️  Plugin ${metadata.name} already loaded`);
        return false;
      }

      // Load plugin module
      const mainPath = path.join(pluginPath, metadata.main);
      delete require.cache[require.resolve(mainPath)]; // Clear cache for hot reload
      
      const PluginClass = require(mainPath).default || require(mainPath);
      const plugin: Plugin = new PluginClass();

      // Verify plugin implements required interface
      if (!plugin.name || !plugin.version) {
        throw new Error('Plugin must implement name and version properties');
      }

      // Store plugin
      this.plugins.set(metadata.name, plugin);
      this.pluginPaths.set(metadata.name, pluginPath);

      // Call plugin onLoad hook
      if (plugin.onLoad) {
        await plugin.onLoad();
      }

      console.log(`✅ Plugin loaded: ${metadata.name} v${metadata.version}`);
      this.emit('plugin:loaded', metadata.name, plugin);

      return true;

    } catch (error) {
      console.error(`❌ Failed to load plugin from ${pluginPath}:`, error);
      return false;
    }
  }

  async unloadPlugin(pluginName: string): Promise<boolean> {
    try {
      const plugin = this.plugins.get(pluginName);
      if (!plugin) {
        console.warn(`⚠️  Plugin ${pluginName} not found`);
        return false;
      }

      console.log(`🔌 Unloading plugin: ${pluginName}`);

      // Call plugin onUnload hook
      if (plugin.onUnload) {
        await plugin.onUnload();
      }

      // Remove plugin
      this.plugins.delete(pluginName);
      this.pluginPaths.delete(pluginName);

      console.log(`✅ Plugin unloaded: ${pluginName}`);
      this.emit('plugin:unloaded', pluginName);

      return true;

    } catch (error) {
      console.error(`❌ Failed to unload plugin ${pluginName}:`, error);
      return false;
    }
  }

  async discoverPlugins(): Promise<string[]> {
    const discoveredPlugins: string[] = [];

    if (!fs.existsSync(this.pluginsDir)) {
      return discoveredPlugins;
    }

    const items = fs.readdirSync(this.pluginsDir);

    for (const item of items) {
      const itemPath = path.join(this.pluginsDir, item);
      const packagePath = path.join(itemPath, 'package.json');

      if (fs.statSync(itemPath).isDirectory() && fs.existsSync(packagePath)) {
        discoveredPlugins.push(itemPath);
      }
    }

    console.log(`🔍 Discovered ${discoveredPlugins.length} plugins`);
    return discoveredPlugins;
  }

  async loadAllPlugins(): Promise<void> {
    const pluginPaths = await this.discoverPlugins();
    
    for (const pluginPath of pluginPaths) {
      await this.loadPlugin(pluginPath);
    }
  }

  async reloadPlugin(pluginName: string): Promise<boolean> {
    const pluginPath = this.pluginPaths.get(pluginName);
    if (!pluginPath) {
      console.error(`❌ Plugin path not found for: ${pluginName}`);
      return false;
    }

    await this.unloadPlugin(pluginName);
    return await this.loadPlugin(pluginPath);
  }

  // Event dispatchers
  async onLogEntry(entry: LogEntry): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      try {
        if (plugin.onLogEntry) {
          await plugin.onLogEntry(entry);
        }
      } catch (error) {
        console.error(`❌ Plugin ${name} onLogEntry error:`, error);
      }
    }
  }

  async onDomainAdded(domain: Domain): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      try {
        if (plugin.onDomainAdded) {
          await plugin.onDomainAdded(domain);
        }
      } catch (error) {
        console.error(`❌ Plugin ${name} onDomainAdded error:`, error);
      }
    }
  }

  async onAlert(alert: Alert): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      try {
        if (plugin.onAlert) {
          await plugin.onAlert(alert);
        }
      } catch (error) {
        console.error(`❌ Plugin ${name} onAlert error:`, error);
      }
    }
  }

  // Data processors
  async processLogLine(line: string, domain: string): Promise<LogEntry | null> {
    for (const [name, plugin] of this.plugins) {
      try {
        if (plugin.processLogLine) {
          const result = await plugin.processLogLine(line, domain);
          if (result) {
            return result; // Return first successful parse
          }
        }
      } catch (error) {
        console.error(`❌ Plugin ${name} processLogLine error:`, error);
      }
    }
    return null;
  }

  async analyzeTraffic(entries: LogEntry[]): Promise<any[]> {
    const results: any[] = [];

    for (const [name, plugin] of this.plugins) {
      try {
        if (plugin.analyzeTraffic) {
          const result = await plugin.analyzeTraffic(entries);
          if (result) {
            results.push({ plugin: name, data: result });
          }
        }
      } catch (error) {
        console.error(`❌ Plugin ${name} analyzeTraffic error:`, error);
      }
    }

    return results;
  }

  // Plugin management
  getLoadedPlugins(): Array<{ name: string; plugin: Plugin }> {
    return Array.from(this.plugins.entries()).map(([name, plugin]) => ({ name, plugin }));
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  isPluginLoaded(name: string): boolean {
    return this.plugins.has(name);
  }

  // Route collection for web server
  getAllRoutes(): Array<{ plugin: string; method: string; path: string; handler: Function }> {
    const routes: Array<{ plugin: string; method: string; path: string; handler: Function }> = [];

    for (const [name, plugin] of this.plugins) {
      try {
        if (plugin.getRoutes) {
          const pluginRoutes = plugin.getRoutes();
          for (const route of pluginRoutes) {
            routes.push({
              plugin: name,
              method: route.method,
              path: `/api/plugins/${name}${route.path}`,
              handler: route.handler
            });
          }
        }
      } catch (error) {
        console.error(`❌ Plugin ${name} getRoutes error:`, error);
      }
    }

    return routes;
  }

  // Plugin installation
  async installPlugin(pluginUrl: string): Promise<boolean> {
    try {
      console.log(`📦 Installing plugin from: ${pluginUrl}`);

      // This is a simplified implementation
      // In production, you'd want to:
      // 1. Download and verify the plugin
      // 2. Check dependencies
      // 3. Run security scans
      // 4. Install to plugins directory
      
      console.log(`✅ Plugin installation would be implemented here`);
      return true;

    } catch (error) {
      console.error(`❌ Plugin installation failed:`, error);
      return false;
    }
  }

  private validatePlugin(metadata: PluginMetadata): void {
    const required = ['name', 'version', 'description', 'author', 'main', 'logsoul_version'];
    
    for (const field of required) {
      if (!(field in metadata)) {
        throw new Error(`Plugin metadata missing required field: ${field}`);
      }
    }

    // Check LogSoul version compatibility
    if (metadata.logsoul_version !== '1.0.0') {
      console.warn(`⚠️  Plugin ${metadata.name} may be incompatible (requires LogSoul ${metadata.logsoul_version})`);
    }
  }

  // Plugin configuration
  async getPluginConfig(pluginName: string): Promise<any> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin || !plugin.getConfig) {
      return null;
    }

    try {
      return await plugin.getConfig();
    } catch (error) {
      console.error(`❌ Failed to get config for plugin ${pluginName}:`, error);
      return null;
    }
  }

  async setPluginConfig(pluginName: string, config: any): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin || !plugin.setConfig) {
      return false;
    }

    try {
      await plugin.setConfig(config);
      return true;
    } catch (error) {
      console.error(`❌ Failed to set config for plugin ${pluginName}:`, error);
      return false;
    }
  }
}