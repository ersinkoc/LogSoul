import { EventEmitter } from 'events';
import { LogEntry, Domain, Alert } from '../types';
export interface Plugin {
    name: string;
    version: string;
    description: string;
    author: string;
    onLoad?(): Promise<void>;
    onUnload?(): Promise<void>;
    onLogEntry?(entry: LogEntry): Promise<void>;
    onDomainAdded?(domain: Domain): Promise<void>;
    onAlert?(alert: Alert): Promise<void>;
    processLogLine?(line: string, domain: string): Promise<LogEntry | null>;
    analyzeTraffic?(entries: LogEntry[]): Promise<any>;
    getRoutes?(): Array<{
        method: string;
        path: string;
        handler: Function;
    }>;
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
export declare class PluginManager extends EventEmitter {
    private plugins;
    private pluginPaths;
    private pluginsDir;
    constructor(pluginsDir?: string);
    private ensurePluginsDirectory;
    loadPlugin(pluginPath: string): Promise<boolean>;
    unloadPlugin(pluginName: string): Promise<boolean>;
    discoverPlugins(): Promise<string[]>;
    loadAllPlugins(): Promise<void>;
    reloadPlugin(pluginName: string): Promise<boolean>;
    onLogEntry(entry: LogEntry): Promise<void>;
    onDomainAdded(domain: Domain): Promise<void>;
    onAlert(alert: Alert): Promise<void>;
    processLogLine(line: string, domain: string): Promise<LogEntry | null>;
    analyzeTraffic(entries: LogEntry[]): Promise<any[]>;
    getLoadedPlugins(): Array<{
        name: string;
        plugin: Plugin;
    }>;
    getPlugin(name: string): Plugin | undefined;
    isPluginLoaded(name: string): boolean;
    getAllRoutes(): Array<{
        plugin: string;
        method: string;
        path: string;
        handler: Function;
    }>;
    installPlugin(pluginUrl: string): Promise<boolean>;
    private validatePlugin;
    getPluginConfig(pluginName: string): Promise<any>;
    setPluginConfig(pluginName: string, config: any): Promise<boolean>;
}
//# sourceMappingURL=index.d.ts.map