import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

import { checkDatabaseHealth, pgPool } from "./src/db/index.js";
import { runMigrations } from "./src/db/migrate.js";
import { seedDatabase } from "./src/db/seed.js";
import * as repo from "./src/db/repository.js";
import { sanitizeUser, verifyPassword, hashPassword } from "./src/auth/session.js";
import { saveDigitalCopy, resolveDigitalCopy, decodeBase64Payload } from "./src/files/digitalCopies.js";

async function startServer() {
  const app = express();
  const PORT = 3031;

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
      const { fileName, fileData, fileType, version, user } = req.body;
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
      const stored = saveDigitalCopy(req.params.id, fileName || "scan.bin", buffer);
      await repo.updateDocument(req.params.id, {
        hasDigitalCopy: true,
        digitalFileName: stored.fileName,
        digitalFileSize: stored.sizeLabel,
        digitalFileType: fileType || "application/octet-stream",
        digitalFileVersion: Number(version) || 1,
        digitalFilePath: stored.relativePath
      }, user);
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

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email)
        return res
          .status(400)
          .json({ success: false, message: "Email address is required." });

      const user = await repo.getUserByEmail(email);
      if (!user) {
        return res
          .status(404)
          .json({
            success: false,
            message: "No account found with this email address.",
          });
      }

      // Check Administrator Approval Status
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

      if (user.password && password) {
        const passwordValid = await verifyPassword(password, user.password);
        if (!passwordValid) {
          return res
            .status(401)
            .json({ success: false, message: "Incorrect password provided." });
        }
      }

      res.json({ success: true, user: sanitizeUser(user) });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const userData = req.body;
      if (!userData.email || !userData.fullName) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Email and full name are required.",
          });
      }

      const existing = await repo.getUserByEmail(userData.email);
      if (existing) {
        return res
          .status(400)
          .json({
            success: false,
            message: "An account with this email address already exists.",
          });
      }

      const user = await repo.createUser({
        ...userData,
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
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/documents", async (req, res) => {
    try {
      const { docData, user, homePath } = req.body;
      const newDoc = await repo.createDocument(docData, user, homePath || "");
      res.status(201).json(newDoc);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/documents/:id", async (req, res) => {
    try {
      const { updates, user } = req.body;
      await repo.updateDocument(req.params.id, updates || req.body, user);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const { user } = req.body;
      const success = await repo.deleteDocument(req.params.id, user);
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
      const { toLocationId, reason, user, fromPath, toPath } = req.body;
      await repo.moveDocument(
        req.params.id,
        toLocationId,
        reason,
        user,
        fromPath,
        toPath,
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Batch Relocate — move multiple documents at once
  app.post("/api/documents/batch-move", async (req, res) => {
    try {
      const { documentIds, toLocationId, reason, user, fromPaths, toPath } = req.body;
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        res.status(400).json({ error: 'documentIds array is required' });
        return;
      }
      const errors: string[] = [];
      for (const docId of documentIds) {
        try {
          await repo.moveDocument(
            docId,
            toLocationId,
            reason || 'Batch Relocation Transfer',
            user,
            fromPaths?.[docId] || 'Unknown',
            toPath || 'Unknown',
          );
        } catch (e: any) {
          errors.push(`${docId}: ${e.message}`);
        }
      }
      res.json({ success: true, moved: documentIds.length - errors.length, errors });
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
      const { documentId, purpose, dueDate, user } = req.body;
      const chk = await repo.requestCheckout(
        documentId,
        purpose,
        dueDate,
        user,
      );
      res.status(201).json(chk);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkouts/:id/approve", async (req, res) => {
    try {
      const { user } = req.body;
      await repo.approveCheckout(req.params.id, user);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkouts/:id/reject", async (req, res) => {
    try {
      const { reason, user } = req.body;
      await repo.rejectCheckout(req.params.id, reason, user);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkouts/:id/dispatch", async (req, res) => {
    try {
      const { tempLocationId, user, fromPath, toPath } = req.body;
      await repo.processCheckoutDispatch(
        req.params.id,
        tempLocationId,
        user,
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
      const { conditionIn, returnLocationId, notes, user, fromPath, toPath } =
        req.body;
      await repo.processCheckInReturn(
        req.params.id,
        conditionIn,
        returnLocationId,
        notes,
        user,
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

  // Audit Logs
  app.get("/api/audit-logs", async (req, res) => {
    try {
      const logs = await repo.getAuditLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/audit-logs", async (req, res) => {
    try {
      const log = await repo.createAuditLog(req.body);
      res.status(201).json(log);
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
      const { bundleData, user } = req.body;
      const newBundle = await repo.createBundle(bundleData || req.body, user);
      res.status(201).json(newBundle);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/bundles/:id", async (req, res) => {
    try {
      const { updates, user } = req.body;
      await repo.updateBundle(req.params.id, updates || req.body, user);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/bundles/:id", async (req, res) => {
    try {
      const { user } = req.body;
      await repo.deleteBundle(req.params.id, user);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/bundles/:id/add-documents", async (req, res) => {
    try {
      const { documentIds, user } = req.body;
      await repo.addDocumentsToBundle(req.params.id, documentIds, user);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/bundles/:id/remove-document", async (req, res) => {
    try {
      const { documentId, user } = req.body;
      await repo.removeDocumentFromBundle(req.params.id, documentId, user);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
