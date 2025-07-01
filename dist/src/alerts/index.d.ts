import { EventEmitter } from 'events';
import { Storage } from '../storage';
import { LogAnalyzer } from '../analyzer';
import { Config, LogEntry } from '../types';
export interface AlertRule {
    id: string;
    name: string;
    domain?: string;
    type: 'error_rate' | 'response_time' | 'traffic_spike' | 'security_threat' | 'custom';
    condition: AlertCondition;
    enabled: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    cooldown: number;
    lastTriggered?: Date;
}
export interface AlertCondition {
    threshold: number;
    timeWindow: string;
    operator: '>' | '<' | '=' | '>=' | '<=';
    metric: string;
}
export interface NotificationChannel {
    type: 'email' | 'webhook' | 'console';
    config: any;
    enabled: boolean;
}
export declare class AlertManager extends EventEmitter {
    private storage;
    private analyzer;
    private config;
    private rules;
    private channels;
    private checkInterval?;
    constructor(storage: Storage, analyzer: LogAnalyzer, config: Config);
    private initializeDefaultRules;
    private initializeChannels;
    addRule(rule: AlertRule): void;
    removeRule(ruleId: string): void;
    enableRule(ruleId: string): void;
    disableRule(ruleId: string): void;
    start(): void;
    stop(): void;
    private checkAlerts;
    private checkDomainAlerts;
    private isInCooldown;
    private evaluateRule;
    private parseTimeWindow;
    private checkErrorRate;
    private checkResponseTime;
    private checkTrafficSpike;
    private checkSecurityThreats;
    private compareValues;
    private triggerAlert;
    private sendNotifications;
    private sendNotification;
    private sendConsoleNotification;
    private sendEmailNotification;
    private sendWebhookNotification;
    processLogEntry(entry: LogEntry): Promise<void>;
    private checkImmediateAlerts;
    getRules(): AlertRule[];
    getRule(ruleId: string): AlertRule | undefined;
    getChannels(): NotificationChannel[];
    addChannel(channel: NotificationChannel): void;
    removeChannel(type: string): void;
}
//# sourceMappingURL=index.d.ts.map