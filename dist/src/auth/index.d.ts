import { Storage } from '../storage';
export interface User {
    id: number;
    username: string;
    email: string;
    password_hash: string;
    salt: string;
    role: 'admin' | 'user' | 'viewer';
    created_at: Date;
    last_login?: Date;
    is_active: boolean;
    permissions: string[];
}
export interface Session {
    id: string;
    user_id: number;
    token: string;
    created_at: Date;
    expires_at: Date;
    ip_address?: string;
    user_agent?: string;
    is_active: boolean;
}
export interface LoginAttempt {
    id: number;
    username: string;
    ip_address: string;
    success: boolean;
    attempted_at: Date;
    user_agent?: string;
}
export interface AuthConfig {
    jwt_secret: string;
    session_timeout: number;
    max_login_attempts: number;
    lockout_duration: number;
    password_min_length: number;
    require_special_chars: boolean;
    require_numbers: boolean;
}
export declare class AuthManager {
    private storage;
    private config;
    constructor(storage: Storage, config?: Partial<AuthConfig>);
    private initializeAuthTables;
    private generateSecret;
    createUser(username: string, email: string, password: string, role?: 'admin' | 'user' | 'viewer'): Promise<User | null>;
    authenticate(username: string, password: string, ipAddress?: string, userAgent?: string): Promise<{
        user: User;
        token: string;
    } | null>;
    validateToken(token: string): Promise<User | null>;
    logout(token: string): Promise<boolean>;
    changePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean>;
    updateUserRole(userId: number, newRole: 'admin' | 'user' | 'viewer'): Promise<boolean>;
    getUserSessions(userId: number): Promise<Session[]>;
    getLoginHistory(userId: number, limit?: number): Promise<LoginAttempt[]>;
    private validateUsername;
    private validateEmail;
    private validatePassword;
    private hashPassword;
    private verifyPassword;
    private generateToken;
    private getDefaultPermissions;
    private insertUser;
    private getUserByUsername;
    private getUserByEmail;
    private getUserById;
    private updateLastLogin;
    private createSession;
    private getSessionByToken;
    private invalidateSession;
    private invalidateAllUserSessions;
    private updateUserPassword;
    private updateUserRoleAndPermissions;
    private recordLoginAttempt;
    private isUserLockedOut;
    hasPermission(user: User, permission: string): boolean;
    requirePermission(permission: string): (req: any, res: any, next: any) => any;
    requireAuth(): (req: any, res: any, next: any) => Promise<any>;
}
//# sourceMappingURL=index.d.ts.map