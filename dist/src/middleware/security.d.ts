import { Request, Response, NextFunction } from 'express';
import { Storage } from '../storage';
export interface SecurityMiddlewareConfig {
    storage: Storage;
    securityConfig?: any;
}
export declare class SecurityMiddleware {
    private security;
    private waf;
    private rateLimiters;
    constructor(config: SecurityMiddlewareConfig);
    applySecurityHeaders(): any;
    customSecurityHeaders(): (req: Request, res: Response, next: NextFunction) => void;
    globalRateLimit(): any;
    apiRateLimit(): any;
    authRateLimit(): any;
    validateInput(): (req: Request, res: Response, next: NextFunction) => Promise<any>;
    ipSecurity(): (req: Request, res: Response, next: NextFunction) => Promise<any>;
    csrfProtection(): (req: Request, res: Response, next: NextFunction) => any;
    auditLog(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    fileUploadSecurity(): (req: Request, res: Response, next: NextFunction) => any;
    applyAll(): any[];
}
export declare const createSecurityMiddleware: (config: SecurityMiddlewareConfig) => SecurityMiddleware;
//# sourceMappingURL=security.d.ts.map