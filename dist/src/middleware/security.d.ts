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
    applySecurityHeaders(): (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
    customSecurityHeaders(): (req: Request, res: Response, next: NextFunction) => void;
    globalRateLimit(): any;
    apiRateLimit(): any;
    authRateLimit(): any;
    validateInput(): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    ipSecurity(): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    csrfProtection(): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    auditLog(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    fileUploadSecurity(): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    applyAll(): any[];
}
export declare const createSecurityMiddleware: (config: SecurityMiddlewareConfig) => SecurityMiddleware;
//# sourceMappingURL=security.d.ts.map