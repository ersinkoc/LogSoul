"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthManager = void 0;
const crypto = __importStar(require("crypto"));
const jwt = __importStar(require("jsonwebtoken"));
class AuthManager {
    constructor(storage, config) {
        this.storage = storage;
        this.config = {
            jwt_secret: process.env.JWT_SECRET || this.generateSecret(),
            session_timeout: 480, // 8 hours
            max_login_attempts: 5,
            lockout_duration: 15, // 15 minutes
            password_min_length: 8,
            require_special_chars: true,
            require_numbers: true,
            ...config
        };
        this.initializeAuthTables();
    }
    async initializeAuthTables() {
        // This would extend the Storage class or use a separate auth database
        // For now, we'll assume the tables are created elsewhere
        console.log('🔐 Auth system initialized');
    }
    generateSecret() {
        return crypto.randomBytes(64).toString('hex');
    }
    async createUser(username, email, password, role = 'user') {
        try {
            // Validate input
            if (!this.validateUsername(username)) {
                throw new Error('Invalid username format');
            }
            if (!this.validateEmail(email)) {
                throw new Error('Invalid email format');
            }
            const passwordValidation = this.validatePassword(password);
            if (!passwordValidation.valid) {
                throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
            }
            // Check if user already exists
            const existingUser = await this.getUserByUsername(username);
            if (existingUser) {
                throw new Error('Username already exists');
            }
            const existingEmail = await this.getUserByEmail(email);
            if (existingEmail) {
                throw new Error('Email already registered');
            }
            // Hash password
            const salt = crypto.randomBytes(32).toString('hex');
            const passwordHash = this.hashPassword(password, salt);
            // Define default permissions based on role
            const permissions = this.getDefaultPermissions(role);
            const user = {
                username,
                email,
                password_hash: passwordHash,
                salt,
                role,
                created_at: new Date(),
                is_active: true,
                permissions
            };
            // Insert user into database (this would need to be implemented in Storage)
            const userId = await this.insertUser(user);
            console.log(`👤 User created: ${username} (${role})`);
            return {
                ...user,
                id: userId
            };
        }
        catch (error) {
            console.error(`❌ Failed to create user: ${error}`);
            return null;
        }
    }
    async authenticate(username, password, ipAddress, userAgent) {
        try {
            // Check if user is locked out
            if (await this.isUserLockedOut(username, ipAddress)) {
                throw new Error('Account temporarily locked due to too many failed attempts');
            }
            // Get user
            const user = await this.getUserByUsername(username);
            if (!user || !user.is_active) {
                await this.recordLoginAttempt(username, ipAddress || '', false, userAgent);
                throw new Error('Invalid credentials');
            }
            // Verify password
            const passwordValid = this.verifyPassword(password, user.password_hash, user.salt);
            if (!passwordValid) {
                await this.recordLoginAttempt(username, ipAddress || '', false, userAgent);
                throw new Error('Invalid credentials');
            }
            // Record successful login
            await this.recordLoginAttempt(username, ipAddress || '', true, userAgent);
            await this.updateLastLogin(user.id);
            // Create session token
            const token = this.generateToken(user);
            await this.createSession(user.id, token, ipAddress, userAgent);
            console.log(`✅ User authenticated: ${username}`);
            return { user, token };
        }
        catch (error) {
            console.error(`❌ Authentication failed for ${username}: ${error}`);
            return null;
        }
    }
    async validateToken(token) {
        try {
            // Verify JWT token
            const decoded = jwt.verify(token, this.config.jwt_secret);
            // Check if session is still valid
            const session = await this.getSessionByToken(token);
            if (!session || !session.is_active || session.expires_at < new Date()) {
                return null;
            }
            // Get user
            const user = await this.getUserById(decoded.userId);
            if (!user || !user.is_active) {
                return null;
            }
            return user;
        }
        catch (error) {
            return null;
        }
    }
    async logout(token) {
        try {
            // Invalidate session
            await this.invalidateSession(token);
            console.log('👋 User logged out');
            return true;
        }
        catch (error) {
            console.error(`❌ Logout failed: ${error}`);
            return false;
        }
    }
    async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            // Verify current password
            if (!this.verifyPassword(currentPassword, user.password_hash, user.salt)) {
                throw new Error('Current password is incorrect');
            }
            // Validate new password
            const passwordValidation = this.validatePassword(newPassword);
            if (!passwordValidation.valid) {
                throw new Error(`New password validation failed: ${passwordValidation.errors.join(', ')}`);
            }
            // Hash new password
            const salt = crypto.randomBytes(32).toString('hex');
            const passwordHash = this.hashPassword(newPassword, salt);
            // Update password
            await this.updateUserPassword(userId, passwordHash, salt);
            // Invalidate all sessions for this user
            await this.invalidateAllUserSessions(userId);
            console.log(`🔑 Password changed for user ID: ${userId}`);
            return true;
        }
        catch (error) {
            console.error(`❌ Password change failed: ${error}`);
            return false;
        }
    }
    async updateUserRole(userId, newRole) {
        try {
            const permissions = this.getDefaultPermissions(newRole);
            await this.updateUserRoleAndPermissions(userId, newRole, permissions);
            console.log(`👤 User role updated: ${userId} -> ${newRole}`);
            return true;
        }
        catch (error) {
            console.error(`❌ Role update failed: ${error}`);
            return false;
        }
    }
    async getUserSessions(userId) {
        // This would query the sessions table
        return [];
    }
    async getLoginHistory(userId, limit = 50) {
        // This would query the login_attempts table
        return [];
    }
    // Helper methods
    validateUsername(username) {
        return /^[a-zA-Z0-9_]{3,30}$/.test(username);
    }
    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    validatePassword(password) {
        const errors = [];
        if (password.length < this.config.password_min_length) {
            errors.push(`Must be at least ${this.config.password_min_length} characters long`);
        }
        if (this.config.require_numbers && !/\d/.test(password)) {
            errors.push('Must contain at least one number');
        }
        if (this.config.require_special_chars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Must contain at least one special character');
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    hashPassword(password, salt) {
        return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
    }
    verifyPassword(password, hash, salt) {
        const expectedHash = this.hashPassword(password, salt);
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
    }
    generateToken(user) {
        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions
        };
        return jwt.sign(payload, this.config.jwt_secret, {
            expiresIn: `${this.config.session_timeout}m`,
            issuer: 'logsoul',
            subject: user.id.toString()
        });
    }
    getDefaultPermissions(role) {
        switch (role) {
            case 'admin':
                return [
                    'domains:read', 'domains:write', 'domains:delete',
                    'logs:read', 'logs:write', 'logs:delete',
                    'alerts:read', 'alerts:write', 'alerts:delete',
                    'users:read', 'users:write', 'users:delete',
                    'system:read', 'system:write',
                    'plugins:read', 'plugins:write',
                    'backup:read', 'backup:write'
                ];
            case 'user':
                return [
                    'domains:read', 'domains:write',
                    'logs:read',
                    'alerts:read', 'alerts:write',
                    'system:read'
                ];
            case 'viewer':
                return [
                    'domains:read',
                    'logs:read',
                    'alerts:read'
                ];
            default:
                return [];
        }
    }
    // Database operations (these would need to be implemented)
    async insertUser(user) {
        // Implementation would go here
        return 1; // Mock ID
    }
    async getUserByUsername(username) {
        // Implementation would go here
        return null;
    }
    async getUserByEmail(email) {
        // Implementation would go here
        return null;
    }
    async getUserById(id) {
        // Implementation would go here
        return null;
    }
    async updateLastLogin(userId) {
        // Implementation would go here
    }
    async createSession(userId, token, ipAddress, userAgent) {
        // Implementation would go here
    }
    async getSessionByToken(token) {
        // Implementation would go here
        return null;
    }
    async invalidateSession(token) {
        // Implementation would go here
    }
    async invalidateAllUserSessions(userId) {
        // Implementation would go here
    }
    async updateUserPassword(userId, passwordHash, salt) {
        // Implementation would go here
    }
    async updateUserRoleAndPermissions(userId, role, permissions) {
        // Implementation would go here
    }
    async recordLoginAttempt(username, ipAddress, success, userAgent) {
        // Implementation would go here
    }
    async isUserLockedOut(username, ipAddress) {
        // Implementation would go here
        return false;
    }
    hasPermission(user, permission) {
        return user.permissions.includes(permission);
    }
    requirePermission(permission) {
        return (req, res, next) => {
            const user = req.user;
            if (!user || !this.hasPermission(user, permission)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            next();
        };
    }
    requireAuth() {
        return async (req, res, next) => {
            try {
                const token = req.headers.authorization?.replace('Bearer ', '');
                if (!token) {
                    return res.status(401).json({ error: 'No token provided' });
                }
                const user = await this.validateToken(token);
                if (!user) {
                    return res.status(401).json({ error: 'Invalid token' });
                }
                req.user = user;
                next();
            }
            catch (error) {
                res.status(401).json({ error: 'Authentication failed' });
            }
        };
    }
}
exports.AuthManager = AuthManager;
//# sourceMappingURL=index.js.map