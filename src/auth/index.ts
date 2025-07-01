import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
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
  session_timeout: number; // minutes
  max_login_attempts: number;
  lockout_duration: number; // minutes
  password_min_length: number;
  require_special_chars: boolean;
  require_numbers: boolean;
}

export class AuthManager {
  private storage: Storage;
  private config: AuthConfig;

  constructor(storage: Storage, config?: Partial<AuthConfig>) {
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

  private async initializeAuthTables(): Promise<void> {
    // This would extend the Storage class or use a separate auth database
    // For now, we'll assume the tables are created elsewhere
    console.log('🔐 Auth system initialized');
  }

  private generateSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  async createUser(username: string, email: string, password: string, role: 'admin' | 'user' | 'viewer' = 'user'): Promise<User | null> {
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

      const user: Omit<User, 'id'> = {
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

    } catch (error) {
      console.error(`❌ Failed to create user: ${error}`);
      return null;
    }
  }

  async authenticate(username: string, password: string, ipAddress?: string, userAgent?: string): Promise<{ user: User; token: string } | null> {
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

    } catch (error) {
      console.error(`❌ Authentication failed for ${username}: ${error}`);
      return null;
    }
  }

  async validateToken(token: string): Promise<User | null> {
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, this.config.jwt_secret) as any;
      
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

    } catch (error) {
      return null;
    }
  }

  async logout(token: string): Promise<boolean> {
    try {
      // Invalidate session
      await this.invalidateSession(token);
      console.log('👋 User logged out');
      return true;

    } catch (error) {
      console.error(`❌ Logout failed: ${error}`);
      return false;
    }
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
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

    } catch (error) {
      console.error(`❌ Password change failed: ${error}`);
      return false;
    }
  }

  async updateUserRole(userId: number, newRole: 'admin' | 'user' | 'viewer'): Promise<boolean> {
    try {
      const permissions = this.getDefaultPermissions(newRole);
      await this.updateUserRoleAndPermissions(userId, newRole, permissions);
      
      console.log(`👤 User role updated: ${userId} -> ${newRole}`);
      return true;

    } catch (error) {
      console.error(`❌ Role update failed: ${error}`);
      return false;
    }
  }

  async getUserSessions(userId: number): Promise<Session[]> {
    // This would query the sessions table
    return [];
  }

  async getLoginHistory(userId: number, limit: number = 50): Promise<LoginAttempt[]> {
    // This would query the login_attempts table
    return [];
  }

  // Helper methods
  private validateUsername(username: string): boolean {
    return /^[a-zA-Z0-9_]{3,30}$/.test(username);
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

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

  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
  }

  private verifyPassword(password: string, hash: string, salt: string): boolean {
    const expectedHash = this.hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  }

  private generateToken(user: User): string {
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

  private getDefaultPermissions(role: 'admin' | 'user' | 'viewer'): string[] {
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
  private async insertUser(user: Omit<User, 'id'>): Promise<number> {
    // Implementation would go here
    return 1; // Mock ID
  }

  private async getUserByUsername(username: string): Promise<User | null> {
    // Implementation would go here
    return null;
  }

  private async getUserByEmail(email: string): Promise<User | null> {
    // Implementation would go here
    return null;
  }

  private async getUserById(id: number): Promise<User | null> {
    // Implementation would go here
    return null;
  }

  private async updateLastLogin(userId: number): Promise<void> {
    // Implementation would go here
  }

  private async createSession(userId: number, token: string, ipAddress?: string, userAgent?: string): Promise<void> {
    // Implementation would go here
  }

  private async getSessionByToken(token: string): Promise<Session | null> {
    // Implementation would go here
    return null;
  }

  private async invalidateSession(token: string): Promise<void> {
    // Implementation would go here
  }

  private async invalidateAllUserSessions(userId: number): Promise<void> {
    // Implementation would go here
  }

  private async updateUserPassword(userId: number, passwordHash: string, salt: string): Promise<void> {
    // Implementation would go here
  }

  private async updateUserRoleAndPermissions(userId: number, role: string, permissions: string[]): Promise<void> {
    // Implementation would go here
  }

  private async recordLoginAttempt(username: string, ipAddress: string, success: boolean, userAgent?: string): Promise<void> {
    // Implementation would go here
  }

  private async isUserLockedOut(username: string, ipAddress?: string): Promise<boolean> {
    // Implementation would go here
    return false;
  }

  hasPermission(user: User, permission: string): boolean {
    return user.permissions.includes(permission);
  }

  requirePermission(permission: string) {
    return (req: any, res: any, next: any) => {
      const user = req.user;
      if (!user || !this.hasPermission(user, permission)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    };
  }

  requireAuth() {
    return async (req: any, res: any, next: any) => {
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

      } catch (error) {
        res.status(401).json({ error: 'Authentication failed' });
      }
    };
  }
}