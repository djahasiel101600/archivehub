import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

import { checkDatabaseHealth } from "../src/db/index.js";
import { runMigrations } from "../src/db/migrate.js";
import { seedDatabase } from "../src/db/seed.js";
import * as repo from "../src/db/repository.js";
import { sanitizeUser, signAuthToken, verifyPassword, hashPassword, SESSION_COOKIE_MAX_AGE } from "../src/auth/session.js";
import type { AuthUser } from "../src/auth/session.js";
import { apiGuard } from "../src/auth/apiGuard.js";
import { saveDigitalCopy, resolveDigitalCopy, decodeBase64Payload, validateDigitalCopy } from "../src/files/digitalCopies.js";
import { resolveDocumentPhoto } from "../src/files/documentPhotos.js";
import { calculateLocationPath } from "../src/utils/locationUtils.js";
import type { DocumentItem } from "../src/types.js";

// --- Security helpers -------------------------------------------------------

const RECORDS_WRITE_ROLES = ["ADMIN", "RECORDS_ADMIN", "RECORDS_OFFICER"];

/**
 * Confidentiality policy:
 *  - RESTRICTED: records staff + auditors only
 *  - CONFIDENTIAL: records staff + auditors + the owning department
 *  - INTERNAL / PUBLIC: any authenticated user
 */
function canViewDocument(user: AuthUser, doc: Pick<DocumentItem, "confidentiality" | "departmentId">): boolean {
  if (doc.confidentiality === "RESTRICTED") {
    return RECORDS_WRITE_ROLES.includes(user.role) || user.role === "AUDITOR";
  }
  if (doc.confidentiality === "CONFIDENTIAL") {
    return RECORDS_WRITE_ROLES.includes(user.role) || user.role === "AUDITOR" || user.departmentId === doc.departmentId;
  }
  return true;
}

// Simple in-memory sliding-window rate limiter for credential endpoints.
const authAttempts = new Map<string, { count: number; resetAt: number }>();
function authRateLimited(key: string, maxAttempts: number): boolean {
  const now = Date.now();
  const entry = authAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    authAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > maxAttempts;
}

async function startServer() {
  const app = express();
  const PORT = 3032; // AUDIT SANDBOX ONLY - disposable copy, never touches production instance

  // Baseline security headers on every response.
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=()");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  // CSRF defense-in-depth for cookie-authenticated mutations: browsers always
  // send Origin/Referer, and it must match this host. Bearer-token clients are
  // exempt (tokens are not auto-attached by the browser).
  app.use((req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    if (req.headers.authorization?.startsWith("Bearer ")) return next();
    const source = req.headers.origin || req.headers.referer;
    if (!source) return next();
    try {
      if (new URL(source).host !== req.headers.host) {
        return res.status(403).json({ error: "Cross-origin request blocked." });
      }
    } catch {
      return res.status(403).json({ error: "Invalid request origin." });
    }
    next();
  });

  app.use(apiGuard);

  // Full-database restore endpoint. Registered before the default JSON parser so
  // backup files larger than the standard 10 MB body limit are accepted.
  app.post("/api/import", express.json({ limit: "200mb" }), async (req, res) => {
    try {
      const counts = await repo.importAllData(req.body);
      res.json({ success: true, counts });
    } catch (err: any) {
      const message = err?.message || "Import failed.";
      const status = message.includes("Invalid backup file") ? 400 : 500;
      res.status(status).json({ success: false, message });
    }
  });

  // Digital surrogate copy upload (base64 payload). Registered before the default
  // JSON parser so scans larger than the standard 10 MB body limit are accepted.
  app.post("/api/documents/:id/digital-copy", express.json({ limit: "60mb" }), async (req, res) => {
    try {
      const { fileName, fileData, fileType, version } = req.body;
      if (!req.authUser) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }
      if (!fileData) {
        res.status(400).json({ success: false, error: "fileData payload is required." });
        return;
      }
      const doc = await repo.getDocumentById(req.params.id);
      if (!doc) {
        res.status(404).json({ success: false, error: "Document not found." });
        return;
      }
      const buffer = decodeBase64Payload(fileData);
      if (buffer.length === 0) {
        res.status(400).json({ success: false, error: "Uploaded file is empty." });
        return;
      }
      const validationError = validateDigitalCopy(fileType || "application/octet-stream", buffer.length);
      if (validationError) {
        res.status(400).json({ success: false, error: validationError });
        return;
      }
      const stored = saveDigitalCopy(req.params.id, fileName || "scan.bin", buffer);
      await repo.updateDocument(req.params.id, {
        hasDigitalCopy: true,
        digitalFileName: stored.fileName,
        digitalFileSize: stored.sizeLabel,
        digitalFileType: fileType || "application/octet-stream",
        digitalFileVersion: Number(version) || 1,
        digitalFilePath: stored.relativePath
      }, req.authUser);
      res.json({ success: true, ...stored });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || "Upload failed." });
    }
  });

  // Digital surrogate copy download
  app.get("/api/documents/:id/digital-copy", async (req, res) => {
    try {
      const doc = await repo.getDocumentById(req.params.id);
      if (!doc || !doc.hasDigitalCopy || !doc.digitalFilePath) {
        res.status(404).json({ success: false, error: "No digital copy attached to this document." });
        return;
      }
      if (!req.authUser || !canViewDocument(req.authUser, doc)) {
        res.status(403).json({ success: false, error: "You do not have permission to download this digital copy." });
        return;
      }
      const absolute = resolveDigitalCopy(doc.digitalFilePath);
      if (!absolute) {
        res.status(404).json({ success: false, error: "Digital copy file not found on server storage." });
        return;
      }
      res.setHeader("Content-Disposition", `attachment; filename="${doc.digitalFileName || path.basename(absolute)}"`);
      res.sendFile(absolute);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Download failed." });
    }
  });

  // Stored document photo serving (photos are offloaded from the JSONB row to
  // disk; the record only keeps metadata + this serving URL).
  app.get("/api/documents/:id/photos/:photoId", async (req, res) => {
    try {
      const doc = await repo.getDocumentById(req.params.id);
      if (!doc) {
        res.status(404).json({ error: "Document not found." });
        return;
      }
      if (!req.authUser || !canViewDocument(req.authUser, doc)) {
        res.status(403).json({ error: "You do not have permission to view this photo." });
        return;
      }
      const absolute = resolveDocumentPhoto(req.params.id, req.params.photoId);
      if (!absolute) {
        res.status(404).json({ error: "Photo not found." });
        return;
      }
      res.sendFile(absolute);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Photo load failed." });
    }
  });

  app.use(express.json({ limit: "10mb" }));

  // Check PostgreSQL health and auto-run migrations & seed on server startup
  const startupDbHealth = await checkDatabaseHealth();
  if (startupDbHealth.connected) {
    try {
      await runMigrations();
      await seedDatabase();
      console.log(
        "[Startup] PostgreSQL database migrations and initial seed executed successfully.",
      );
    } catch (err: any) {
      console.warn(
        "[Startup] Failed to auto-migrate/seed PostgreSQL database:",
        err?.message || err,
      );
    }
  } else {
    console.warn(
      `[Startup] PostgreSQL not connected (${startupDbHealth.message}). Running in fallback memory mode.`,
    );
  }

  // --- API ROUTES ---

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    const dbHealth = await checkDatabaseHealth();
    res.json({
      status: "ok",
      service: "ArchiveHub PDAMS Backend API",
      database: dbHealth,
      timestamp: new Date().toISOString(),
    });
  });

  // Seed / Reset Database endpoint
  app.post("/api/seed", async (req, res) => {
    try {
      const dbHealth = await checkDatabaseHealth();
      if (!dbHealth.connected) {
        return res.status(400).json({
          success: false,
          error: `PostgreSQL is not connected (${dbHealth.message}). Create a .env file with your Supabase DATABASE_URL.`,
        });
      }
      await runMigrations();
      await seedDatabase(true);
      res.json({
        success: true,
        message: "Database migrations executed and default seed data loaded.",
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Clear Operational Database endpoint
  app.post("/api/clear-data", async (req, res) => {
    try {
      const result = await repo.clearCustomDataFromDb();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Departments
  app.get("/api/departments", async (req, res) => {
    try {
      const depts = await repo.getDepartments();
      res.json(depts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/departments", async (req, res) => {
    try {
      const newDept = await repo.createDepartment(req.body);
      res.status(201).json(newDept);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/departments/:id", async (req, res) => {
    try {
      await repo.updateDepartment(req.params.id, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/departments/:id", async (req, res) => {
    try {
      await repo.deleteDepartment(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Users & Auth
  app.get("/api/users", async (req, res) => {
    try {
      const users = await repo.getUsers();
      res.json(users.map(sanitizeUser));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Full-database backup export (all tables as raw rows)
  app.get("/api/export", async (req, res) => {
    try {
      const payload = await repo.exportAllData();
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // CSV export endpoints (one per entity type)
  app.get("/api/export/csv/documents", async (req, res) => {
    try {
      const docs = await repo.getDocuments();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="documents-${new Date().toISOString().slice(0,10)}.csv"`);
      const csv = repo.generateCsvFromDocuments(docs);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/export/csv/locations", async (req, res) => {
    try {
      const locations = await repo.getLocations();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="locations-${new Date().toISOString().slice(0,10)}.csv"`);
      const csv = repo.generateCsvFromLocations(locations);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/export/csv/users", async (req, res) => {
    try {
      const users = await repo.getUsers();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="users-${new Date().toISOString().slice(0,10)}.csv"`);
      const csv = repo.generateCsvFromUsers(users);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/export/csv/document-types", async (req, res) => {
    try {
      const docTypes = await repo.getDocumentTypes();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="document_types-${new Date().toISOString().slice(0,10)}.csv"`);
      const csv = repo.generateCsvFromDocumentTypes(docTypes);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/export/csv/checkouts", async (req, res) => {
    try {
      const checkouts = await repo.getCheckouts();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="checkouts-${new Date().toISOString().slice(0,10)}.csv"`);
      const csv = repo.generateCsvFromCheckouts(checkouts);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/export/csv/movements", async (req, res) => {
    try {
      const movements = await repo.getMovements();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="movements-${new Date().toISOString().slice(0,10)}.csv"`);
      const csv = repo.generateCsvFromMovements(movements);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/export/csv/retention-policies", async (req, res) => {
    try {
      const policies = await repo.getRetentionPolicies();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="retention_policies-${new Date().toISOString().slice(0,10)}.csv"`);
      const csv = repo.generateCsvFromRetentionPolicies(policies);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/export/csv/bundles", async (req, res) => {
    try {
      const bundles = await repo.getBundles();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="bundles-${new Date().toISOString().slice(0,10)}.csv"`);
      const csv = repo.generateCsvFromBundles(bundles);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/export/csv/disposals", async (req, res) => {
    try {
      const disposals = await repo.getDisposals();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="disposals-${new Date().toISOString().slice(0,10)}.csv"`);
      const csv = repo.generateCsvFromDisposals(disposals);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/export/csv/audit-logs", async (req, res) => {
    try {
      const auditLogs = await repo.getAuditLogs();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="audit_logs-${new Date().toISOString().slice(0,10)}.csv"`);
      const csv = repo.generateCsvFromAuditLogs(auditLogs);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res
          .status(400)
          .json({ success: false, message: "Email and password are required." });

      const rateKey = `${req.ip}:${String(email).toLowerCase()}`;
      if (authRateLimited(rateKey, 10)) {
        return res.status(429).json({
          success: false,
          message: "Too many sign-in attempts. Please wait 15 minutes and try again.",
        });
      }

      const user = await repo.getUserByEmail(String(email).trim().toLowerCase());
      // Uniform error for unknown account AND wrong password: no enumeration.
      if (!user || !(await verifyPassword(password, user.password))) {
        return res
          .status(401)
          .json({ success: false, message: "Incorrect email or password." });
      }

      // Approval gates are only revealed after the credentials prove valid.
      if (user.approvalStatus === "PENDING_APPROVAL") {
        return res.status(403).json({
          success: false,
          isPendingApproval: true,
          message:
            "Your account is pending Administrator approval. You will be granted access once an Admin approves your registration.",
        });
      }

      if (user.approvalStatus === "REJECTED") {
        return res.status(403).json({
          success: false,
          message:
            "Your account access request was rejected by an Administrator. Please contact your administrator for assistance.",
        });
      }

      const cookieAttributes = `Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_COOKIE_MAX_AGE}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
      res.setHeader("Set-Cookie", `archivehub_session=${signAuthToken(user)}; ${cookieAttributes}`);
      res.json({ success: true, user: sanitizeUser(user) });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `archivehub_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
    res.json({ success: true });
  });

  // Self-service registration may only request non-privileged roles; staff and
  // admin accounts are provisioned by administrators.
  const SIGNUP_ROLES: Array<"DEPT_USER" | "AUDITOR"> = ["DEPT_USER", "AUDITOR"];

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, fullName, password, role, departmentId, departmentName, title, avatarUrl } = req.body;
      if (!email || !fullName) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Email and full name are required.",
          });
      }
      if (!password || String(password).length < 8) {
        return res.status(400).json({
          success: false,
          message: "A password of at least 8 characters is required.",
        });
      }
      if (authRateLimited(`signup:${req.ip}`, 10)) {
        return res.status(429).json({
          success: false,
          message: "Too many registration attempts. Please try again later.",
        });
      }

      const existing = await repo.getUserByEmail(String(email).trim().toLowerCase());
      if (existing) {
        return res
          .status(400)
          .json({
            success: false,
            message: "An account with this email address already exists.",
          });
      }

      const requestedRole = SIGNUP_ROLES.includes(role) ? role : "DEPT_USER";
      const user = await repo.createUser({
        email: String(email).trim().toLowerCase(),
        fullName,
        password,
        role: requestedRole,
        departmentId: departmentId || "",
        departmentName: departmentName || "",
        title: title || "",
        avatarUrl: avatarUrl || undefined,
        approvalStatus: "PENDING_APPROVAL",
      });

      res.status(201).json({
        success: true,
        user: sanitizeUser(user),
        isPendingApproval: true,
        message:
          "Account registered successfully! It is now pending Administrator approval before you can sign in.",
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const { currentPassword, newPassword, ...rest } = req.body;

      // Only profile fields the account owner may self-update (role & approval stay admin-controlled)
      const allowed: repo.UserProfileUpdates = {};
      (['fullName', 'email', 'title', 'avatarUrl', 'departmentId', 'departmentName'] as const).forEach((key) => {
        if (rest[key] !== undefined) (allowed as any)[key] = rest[key];
      });

      if (newPassword) {
        if (String(newPassword).length < 8) {
          return res.status(400).json({ success: false, message: "New password must be at least 8 characters." });
        }
        const user = await repo.getUserById(req.params.id);
        if (!user) {
          return res.status(404).json({ success: false, message: "User not found." });
        }
        // Accounts that already have a password must prove ownership of the current one
        if (user.password) {
          const currentValid = await verifyPassword(currentPassword, user.password);
          if (!currentValid) {
            return res
              .status(401)
              .json({ success: false, message: "Current password is incorrect." });
          }
        }
        await repo.updateUserPassword(user.id, hashPassword(newPassword));
      }

      const updated = await repo.updateUser(req.params.id, allowed);
      if (!updated) {
        return res.status(404).json({ success: false, message: "User not found." });
      }
      res.json({ success: true, user: sanitizeUser(updated) });
    } catch (err: any) {
      const status = err.message?.includes("email address already exists") ? 400 : 500;
      res.status(status).json({ success: false, message: err.message });
    }
  });

  app.patch("/api/users/:id/approval", async (req, res) => {
    try {
      const { status } = req.body;
      if (!["APPROVED", "REJECTED", "PENDING_APPROVAL"].includes(status)) {
        return res
          .status(400)
          .json({ error: "Invalid approval status provided." });
      }
      const updated = await repo.updateUserApproval(req.params.id, status);
      res.json({ success: true, user: updated ? sanitizeUser(updated) : null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const success = await repo.deleteUser(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Document Types
  app.get("/api/document-types", async (req, res) => {
    try {
      const types = await repo.getDocumentTypes();
      res.json(types);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/document-types", async (req, res) => {
    try {
      const newType = await repo.createDocumentType(req.body);
      res.status(201).json(newType);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/document-types/:id", async (req, res) => {
    try {
      await repo.updateDocumentType(req.params.id, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/document-types/:id", async (req, res) => {
    try {
      await repo.deleteDocumentType(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Locations
  app.get("/api/locations", async (req, res) => {
    try {
      const locs = await repo.getLocations();
      res.json(locs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/locations", async (req, res) => {
    try {
      const newLoc = await repo.createLocation(req.body);
      res.status(201).json(newLoc);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/locations/:id", async (req, res) => {
    try {
      await repo.updateLocation(req.params.id, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/locations/:id", async (req, res) => {
    try {
      const success = await repo.deleteLocation(req.params.id);
      if (!success) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Cannot delete location containing sub-locations or documents.",
          });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Documents
  app.get("/api/documents", async (req, res) => {
    try {
      const docs = await repo.getDocuments();
      const user = req.authUser!;
      const visible = docs.filter(d => canViewDocument(user, d));
      const limit = Number(req.query.limit);
      if (Number.isFinite(limit) && limit > 0) {
        const offset = Math.max(0, Number(req.query.offset) || 0);
        res.json({ items: visible.slice(offset, offset + limit), total: visible.length });
        return;
      }
      res.json(visible);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Server-side scan lookup: resolve a QR/barcode/document number without
  // requiring the full dataset on the client.
  app.get("/api/lookup", async (req, res) => {
    try {
      const code = String(req.query.code || "").trim();
      if (!code) {
        res.status(400).json({ error: "code query parameter is required." });
        return;
      }
      const user = req.authUser!;
      const docs = await repo.getDocuments();
      const doc = docs.find(d => d.qrCode === code || d.barcode === code || d.documentNumber === code);
      if (doc) {
        if (!canViewDocument(user, doc)) {
          res.status(403).json({ error: "You do not have permission to view this record." });
          return;
        }
        res.json({ type: "document", item: doc });
        return;
      }
      const bundles = await repo.getBundles();
      const bundle = bundles.find(b => b.qrCode === code || b.barcode === code || b.bundleNumber === code);
      if (bundle) {
        res.json({ type: "bundle", item: bundle });
        return;
      }
      const locations = await repo.getLocations();
      const location = locations.find(l => l.qrCode === code || l.barcode === code || l.code === code);
      if (location) {
        res.json({ type: "location", item: location });
        return;
      }
      res.status(404).json({ error: "No record matches this code." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Preview the next auto-generated document number for a department + type pair
  app.get("/api/documents/next-number", async (req, res) => {
    try {
      const departmentId = String(req.query.departmentId || "");
      const typeId = String(req.query.typeId || "");
      const number = await repo.generateDocumentNumber(departmentId, typeId);
      res.json({ number });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Single-record fetch (detail pages, scanner remote lookup fallback).
  // Registered after the fixed /next-number path so it does not shadow it.
  app.get("/api/documents/:id", async (req, res) => {
    try {
      const doc = await repo.getDocumentById(req.params.id);
      if (!doc) {
        res.status(404).json({ error: "Document not found." });
        return;
      }
      if (!req.authUser || !canViewDocument(req.authUser, doc)) {
        res.status(403).json({ error: "You do not have permission to view this record." });
        return;
      }
      res.json(doc);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/documents", async (req, res) => {
    try {
      const { docData } = req.body;
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      if (!docData?.departmentId || !docData?.documentTypeId || !docData?.homeLocationId) {
        return res.status(400).json({ error: "Department, document type, and home location are required." });
      }
      if (docData.status !== "DRAFT" && !String(docData.title || "").trim()) {
        return res.status(400).json({ error: "A title is required unless the document is saved as a draft." });
      }
      if (docData.photos !== undefined && (!Array.isArray(docData.photos) || docData.photos.length > 5)) {
        return res.status(400).json({ error: "A document can have at most five photos." });
      }
      // Location paths are computed server-side from the live hierarchy so the
      // stored trail cannot be spoofed or go stale via client payloads.
      const locations = await repo.getLocations();
      const homePath = calculateLocationPath(locations, docData.homeLocationId);
      const newDoc = await repo.createDocument(docData, req.authUser, homePath);
      res.status(201).json(newDoc);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/documents/:id", async (req, res) => {
    try {
      const { updates } = req.body;
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      if (updates?.photos !== undefined && (!Array.isArray(updates.photos) || updates.photos.length > 5)) {
        return res.status(400).json({ error: "A document can have at most five photos." });
      }
      const existing = await repo.getDocumentById(req.params.id);
      if (!existing) return res.status(404).json({ error: "Document not found." });
      const nextStatus = updates?.status ?? existing.status;
      const nextTitle = updates?.title ?? existing.title;
      if (nextStatus !== "DRAFT" && !String(nextTitle || "").trim()) {
        return res.status(400).json({ error: "A title is required unless the document remains a draft." });
      }
      await repo.updateDocument(req.params.id, updates || req.body, req.authUser);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const success = await repo.deleteDocument(req.params.id, req.authUser);
      if (!success) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Cannot delete record while checked out.",
          });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/documents/:id/move", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const { toLocationId, reason } = req.body;
      const doc = await repo.getDocumentById(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found." });
      }
      const locations = await repo.getLocations();
      const fromPath = calculateLocationPath(locations, doc.currentLocationId);
      const toPath = calculateLocationPath(locations, toLocationId);
      await repo.moveDocument(
        req.params.id,
        toLocationId,
        reason,
        req.authUser,
        fromPath,
        toPath,
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Batch Relocate — one transaction, set-based SQL
  app.post("/api/documents/batch-move", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const { documentIds, toLocationId, reason } = req.body;
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        res.status(400).json({ error: 'documentIds array is required' });
        return;
      }
      const locations = await repo.getLocations();
      const docs = await repo.getDocuments();
      const fromPaths: Record<string, string> = {};
      for (const docId of documentIds) {
        const doc = docs.find(d => d.id === docId);
        fromPaths[docId] = calculateLocationPath(locations, doc?.currentLocationId ?? null);
      }
      const toPath = calculateLocationPath(locations, toLocationId);
      const result = await repo.batchMoveDocuments(documentIds, toLocationId, reason, req.authUser, fromPaths, toPath);
      res.json({ success: true, moved: result.moved, errors: [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk Update — apply the same metadata change (security, condition,
  // department, ...) to many documents in one transaction
  app.post("/api/documents/bulk-update", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const { documentIds, updates } = req.body;
      if (!Array.isArray(documentIds) || documentIds.length === 0 || !updates || Object.keys(updates).length === 0) {
        res.status(400).json({ error: 'documentIds array and a non-empty updates object are required' });
        return;
      }
      const result = await repo.bulkUpdateDocuments(documentIds, updates, req.authUser);
      res.json({ success: true, updated: result.updated, errors: [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // QR Code Claim — mark a document's QR code as claimed (scanned)
  app.post("/api/documents/:id/qr-claim", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const result = await repo.claimDocumentQr(req.params.id, req.authUser);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.message });
      }
      res.json({ success: true, message: result.message, claimedAt: result.claimedAt });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // QR Code Unclaim — reset a document's QR code claim status
  app.post("/api/documents/:id/qr-unclaim", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const result = await repo.unclaimDocumentQr(req.params.id, req.authUser);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.message });
      }
      res.json({ success: true, message: result.message });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk Delete — one transaction; checked-out records are skipped
  app.post("/api/documents/bulk-delete", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const { documentIds } = req.body;
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        res.status(400).json({ error: 'documentIds array is required' });
        return;
      }
      const result = await repo.bulkDeleteDocuments(documentIds, req.authUser);
      res.json({ success: result.skipped.length === 0, deleted: result.deleted, skipped: result.skipped });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Checkouts
  app.get("/api/checkouts", async (req, res) => {
    try {
      const chks = await repo.getCheckouts();
      res.json(chks);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkouts/request", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const { documentId, purpose, dueDate } = req.body;
      if (!documentId || !purpose || !dueDate) {
        return res.status(400).json({ error: "documentId, purpose and dueDate are required." });
      }
      const chk = await repo.requestCheckout(
        documentId,
        purpose,
        dueDate,
        req.authUser,
      );
      res.status(201).json(chk);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkouts/:id/approve", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      await repo.approveCheckout(req.params.id, req.authUser);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkouts/:id/reject", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const { reason } = req.body;
      await repo.rejectCheckout(req.params.id, reason, req.authUser);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkouts/:id/dispatch", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const { tempLocationId } = req.body;
      const checkout = (await repo.getCheckouts()).find(c => c.id === req.params.id);
      if (!checkout) {
        return res.status(404).json({ error: "Checkout not found." });
      }
      const doc = await repo.getDocumentById(checkout.documentId);
      const locations = await repo.getLocations();
      const fromPath = calculateLocationPath(locations, doc?.currentLocationId ?? null);
      const toPath = calculateLocationPath(locations, tempLocationId);
      await repo.processCheckoutDispatch(
        req.params.id,
        tempLocationId,
        req.authUser,
        fromPath,
        toPath,
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkouts/:id/return", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const { conditionIn, returnLocationId, notes } = req.body;
      const checkout = (await repo.getCheckouts()).find(c => c.id === req.params.id);
      if (!checkout) {
        return res.status(404).json({ error: "Checkout record not found." });
      }
      const doc = await repo.getDocumentById(checkout.documentId);
      const locations = await repo.getLocations();
      const fromPath = calculateLocationPath(locations, doc?.currentLocationId ?? null);
      const toPath = calculateLocationPath(locations, returnLocationId);
      await repo.processCheckInReturn(
        req.params.id,
        conditionIn,
        returnLocationId,
        notes,
        req.authUser,
        fromPath,
        toPath,
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Movements
  app.get("/api/movements", async (req, res) => {
    try {
      const mvts = await repo.getMovements();
      res.json(mvts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Retention Policies
  app.get("/api/retention-policies", async (req, res) => {
    try {
      const policies = await repo.getRetentionPolicies();
      res.json(policies);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Audit Logs (read-only API; entries are written server-side per operation)
  app.get("/api/audit-logs", async (req, res) => {
    try {
      const logs = await repo.getAuditLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reusable Custom Fields
  app.get("/api/reusable-custom-fields", async (req, res) => {
    try {
      const fields = await repo.getReusableCustomFields();
      res.json(fields);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/reusable-custom-fields", async (req, res) => {
    try {
      const field = await repo.createReusableCustomField(req.body);
      res.status(201).json(field);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/reusable-custom-fields/:id", async (req, res) => {
    try {
      await repo.updateReusableCustomField(req.params.id, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/reusable-custom-fields/:id", async (req, res) => {
    try {
      await repo.deleteReusableCustomField(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bundles & Dossiers
  app.get("/api/bundles", async (req, res) => {
    try {
      const bundles = await repo.getBundles();
      res.json(bundles);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/bundles", async (req, res) => {
    try {
      const { bundleData } = req.body;
      const newBundle = await repo.createBundle(bundleData || req.body, req.authUser);
      res.status(201).json(newBundle);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/bundles/:id", async (req, res) => {
    try {
      const { updates } = req.body;
      await repo.updateBundle(req.params.id, updates || req.body, req.authUser);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/bundles/:id", async (req, res) => {
    try {
      await repo.deleteBundle(req.params.id, req.authUser);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/bundles/:id/add-documents", async (req, res) => {
    try {
      const { documentIds } = req.body;
      await repo.addDocumentsToBundle(req.params.id, documentIds, req.authUser);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/bundles/:id/remove-document", async (req, res) => {
    try {
      const { documentId } = req.body;
      await repo.removeDocumentFromBundle(req.params.id, documentId, req.authUser);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      root: path.resolve(process.cwd(), ".."),
      server: { middlewareMode: true, hmr: { port: 24679 } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ArchiveHub Server] Running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
