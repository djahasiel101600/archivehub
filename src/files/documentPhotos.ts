import fs from 'fs';
import path from 'path';
import type { DocumentPhoto } from '../types.js';

// Document photos are stored as files on disk; the documents.photos JSONB only
// keeps lightweight metadata + a serving URL instead of multi-MB base64 blobs.
const PHOTO_ROOT = path.join(process.cwd(), 'uploads', 'photos');

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif'
};

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export function photoPublicUrl(documentId: string, photoId: string): string {
  return `/api/documents/${documentId}/photos/${photoId}`;
}

/**
 * Offload any base64 data-URL photos to disk and return the photo list with
 * serving URLs. Photos already stored (url starts with /api/) pass through
 * untouched. Throws on undecodable payloads so registration fails loudly.
 */
export function storeDocumentPhotos(documentId: string, photos: DocumentPhoto[]): DocumentPhoto[] {
  if (!Array.isArray(photos) || photos.length === 0) return [];
  const dir = path.join(PHOTO_ROOT, safeSegment(documentId));
  const stored: DocumentPhoto[] = [];

  for (const photo of photos) {
    if (!photo || typeof photo.url !== 'string') continue;
    if (!photo.url.startsWith('data:')) {
      stored.push(photo); // already a stored file reference
      continue;
    }
    const match = /^data:([^;,]+);base64,(.*)$/s.exec(photo.url);
    if (!match) throw new Error('Invalid photo payload: expected a base64 image data URL.');
    const mime = match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) throw new Error('Uploaded photo is empty.');
    if (buffer.length > 10 * 1024 * 1024) throw new Error('Each photo must be 10 MB or smaller.');
    const ext = MIME_EXTENSIONS[mime] || '.jpg';
    const photoId = safeSegment(photo.id || `photo-${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, photoId + ext), buffer);
    stored.push({ ...photo, id: photoId, url: photoPublicUrl(documentId, photoId), fileType: mime });
  }

  pruneDocumentPhotos(documentId, stored.map(p => p.id));
  return stored;
}

/** Remove stored photo files that are no longer referenced by the record. */
export function pruneDocumentPhotos(documentId: string, keepIds: string[]): void {
  const dir = path.join(PHOTO_ROOT, safeSegment(documentId));
  if (!fs.existsSync(dir)) return;
  const keep = new Set(keepIds);
  for (const entry of fs.readdirSync(dir)) {
    const base = entry.replace(/\.[^.]+$/, '');
    if (!keep.has(base)) {
      try { fs.unlinkSync(path.join(dir, entry)); } catch { /* best effort */ }
    }
  }
}

/** Resolve a stored photo file, guarding against path traversal. */
export function resolveDocumentPhoto(documentId: string, photoId: string): string | null {
  const dir = path.join(PHOTO_ROOT, safeSegment(documentId));
  const normalizedRoot = path.resolve(PHOTO_ROOT);
  if (!fs.existsSync(dir)) return null;
  const base = safeSegment(photoId);
  for (const entry of fs.readdirSync(dir)) {
    if (entry.replace(/\.[^.]+$/, '') !== base) continue;
    const absolute = path.resolve(dir, entry);
    if (!absolute.startsWith(normalizedRoot + path.sep)) return null;
    return absolute;
  }
  return null;
}

/** Remove every stored file (photos + digital surrogate) for a deleted record. */
export function deleteDocumentFiles(documentId: string): void {
  const segment = safeSegment(documentId);
  for (const root of [PHOTO_ROOT, path.join(process.cwd(), 'uploads', 'digital')]) {
    const dir = path.join(root, segment);
    try {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch { /* best effort cleanup */ }
  }
}
