import { EventEmitter } from 'events';
import { Config } from '../types';
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
export declare class ConfigManager extends EventEmitter {
    private config;
    private configPath;
    private validationRules;
    private watchers;
    private changeHistory;
    constructor(configPath: string);
    private setupValidationRules;
    private loadConfig;
    private saveConfig;
    private watchConfigFile;
    private reloadConfig;
    private detectChanges;
    validateConfig(config: any): {
        valid: boolean;
        errors: string[];
    };
    private validateValue;
    private getNestedValue;
    private setNestedValue;
    private getDefaultConfig;
    getConfig(): Config;
    get<T>(path: string): T;
    set(path: string, value: any): boolean;
    reset(): void;
    getChangeHistory(): ConfigChangeEvent[];
    exportConfig(): string;
    importConfig(configString: string): boolean;
    addValidationRule(rule: ConfigValidationRule): void;
    removeValidationRule(path: string): void;
    destroy(): void;
}
//# sourceMappingURL=index.d.ts.map