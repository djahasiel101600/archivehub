import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { RoleCode, User } from '../types.js';

const TOKEN_TTL = '7d';

export type AuthUser = Omit<User, 'password'>;

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: RoleCode;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;
  return 'archivehub-dev-session-secret';
}

export function sanitizeUser(user: User): AuthUser {
  const { password: _pw, ...safe } = user;
  return safe;
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function isPasswordHash(value: string | undefined): boolean {
  return Boolean(value && /^\$2[aby]\$/.test(value));
}

export async function verifyPassword(plain: string | undefined, stored: string | undefined): Promise<boolean> {
  if (!plain || !stored) return false;
  if (isPasswordHash(stored)) {
    return bcrypt.compare(plain, stored);
  }
  return stored === plain;
}

export function signAuthToken(user: User): string {
  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role
  };
  return jwt.sign(payload, getSessionSecret(), { expiresIn: TOKEN_TTL });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, getSessionSecret()) as AuthTokenPayload;
  } catch {
    return null;
  }
}
