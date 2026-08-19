import type { NextFunction, Request, Response } from 'express';
import type { RoleCode } from '../types.js';
import * as repo from '../db/repository.js';
import { sanitizeUser, verifyAuthToken } from './session.js';

const WRITE_ROLES: RoleCode[] = ['ADMIN', 'RECORDS_ADMIN', 'RECORDS_OFFICER'];
const CATALOG_ROLES: RoleCode[] = ['ADMIN', 'RECORDS_ADMIN'];
const ADMIN_ONLY: RoleCode[] = ['ADMIN'];
const CIRCULATION_ROLES: RoleCode[] = ['ADMIN', 'RECORDS_ADMIN', 'RECORDS_OFFICER'];

function isPublicApi(req: Request): boolean {
  const path = req.path;
  if (req.method === 'GET' && path === '/api/health') return true;
  if (req.method === 'POST' && path === '/api/auth/login') return true;
  if (req.method === 'POST' && path === '/api/auth/signup') return true;
  return false;
}

function hasRole(userRole: RoleCode, allowed: RoleCode[]): boolean {
  return allowed.includes(userRole);
}

function forbidden(res: Response, message = 'You do not have permission to perform this action.') {
  return res.status(403).json({ error: message });
}

export async function apiGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api')) return next();
  if (isPublicApi(req)) return next();

  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }

  const user = await repo.getUserById(payload.sub);
  if (!user) {
    return res.status(401).json({ error: 'Account no longer exists.' });
  }
  if (user.approvalStatus && user.approvalStatus !== 'APPROVED') {
    return res.status(403).json({ error: 'Account is not approved for access.' });
  }

  req.authUser = sanitizeUser(user);
  const role = user.role as RoleCode;

  if (req.method === 'GET') {
    if (req.path === '/api/users' && !hasRole(role, ADMIN_ONLY.concat(['RECORDS_ADMIN', 'AUDITOR']))) {
      // Department users can see a reduced directory — still authenticated
    }
    return next();
  }

  if (req.path === '/api/auth/impersonate') {
    return hasRole(role, ADMIN_ONLY) ? next() : forbidden(res, 'Only administrators can switch personas.');
  }

  if (req.path.startsWith('/api/users') || req.path === '/api/seed' || req.path === '/api/clear-data') {
    return hasRole(role, ADMIN_ONLY) ? next() : forbidden(res, 'Administrator access required.');
  }

  if (req.path.startsWith('/api/document-types') || req.path.startsWith('/api/reusable-custom-fields') || req.path.startsWith('/api/departments')) {
    return hasRole(role, CATALOG_ROLES) ? next() : forbidden(res);
  }

  if (req.path.startsWith('/api/locations') || req.path.startsWith('/api/documents') || req.path.startsWith('/api/bundles')) {
    return hasRole(role, WRITE_ROLES) ? next() : forbidden(res);
  }

  if (req.path === '/api/checkouts/request') {
    return role === 'AUDITOR' ? forbidden(res, 'Auditors have read-only access.') : next();
  }

  if (req.path.startsWith('/api/checkouts')) {
    return hasRole(role, CIRCULATION_ROLES) ? next() : forbidden(res);
  }

  if (req.path.startsWith('/api/ai')) {
    return hasRole(role, WRITE_ROLES) ? next() : forbidden(res);
  }

  if (req.path === '/api/audit-logs' && req.method === 'POST') {
    return next();
  }

  if (role === 'AUDITOR') {
    return forbidden(res, 'Auditors have read-only access.');
  }

  return next();
}
