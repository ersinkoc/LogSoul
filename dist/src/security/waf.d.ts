import { Request, Response, NextFunction } from 'express';
import { SecurityManager } from './index';
export interface WAFRule {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'sql_injection' | 'xss' | 'lfi' | 'rfi' | 'rce' | 'xxe' | 'csrf' | 'custom';
    patterns: RegExp[];
    action: 'block' | 'log' | 'challenge';
    targets: ('query' | 'body' | 'headers' | 'cookies' | 'path')[];
}
export declare class WebApplicationFirewall {
    private rules;
    private security;
    private blockedRequests;
    constructor(security: SecurityManager);
    private initializeRules;
    addRule(rule: WAFRule): void;
    removeRule(ruleId: string): void;
    enableRule(ruleId: string): void;
    disableRule(ruleId: string): void;
    private extractValue;
    inspect(req: Request): Promise<{
        blocked: boolean;
        rule?: WAFRule;
        match?: string;
    }>;
    middleware(): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    getStats(): {
        totalRules: number;
        enabledRules: number;
        blockedRequests: Map<string, number>;
    };
    resetBlockedRequests(): void;
}
export declare const createWAF: (security: SecurityManager) => WebApplicationFirewall;
//# sourceMappingURL=waf.d.ts.map