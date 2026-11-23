import fs from 'fs';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'digital');

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'scan.bin';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function saveDigitalCopy(documentId: string, originalName: string, buffer: Buffer): {
  relativePath: string;
  fileName: string;
  sizeLabel: string;
} {
  const dir = path.join(UPLOAD_ROOT, documentId);
  fs.mkdirSync(dir, { recursive: true });
  const fileName = safeFileName(originalName);
  const absolute = path.join(dir, fileName);
  fs.writeFileSync(absolute, buffer);
  return {
    relativePath: path.join(documentId, fileName).replace(/\\/g, '/'),
    fileName,
    sizeLabel: formatFileSize(buffer.length)
  };
}

export function resolveDigitalCopy(relativePath: string | undefined | null): string | null {
  if (!relativePath) return null;
  const absolute = path.join(UPLOAD_ROOT, relativePath);
  const normalizedRoot = path.resolve(UPLOAD_ROOT);
  const normalizedFile = path.resolve(absolute);
  if (!normalizedFile.startsWith(normalizedRoot + path.sep)) return null;
  if (!fs.existsSync(normalizedFile)) return null;
  return normalizedFile;
}

export function decodeBase64Payload(dataBase64: string): Buffer {
  const cleaned = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
  return Buffer.from(cleaned, 'base64');
}

// Surrogate copies must be recognizable document/image formats, not arbitrary
// executables. Keep in sync with the accept attribute on the upload control.
const ALLOWED_COPY_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/gif', 'image/avif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv'
]);

export const MAX_DIGITAL_COPY_BYTES = 40 * 1024 * 1024;

export function validateDigitalCopy(fileType: string | undefined, byteLength: number): string | null {
  if (byteLength > MAX_DIGITAL_COPY_BYTES) return 'Digital copy exceeds the 40 MB size limit.';
  if (fileType && !ALLOWED_COPY_TYPES.has(fileType.toLowerCase())) {
    return `Unsupported file type "${fileType}". Upload PDF, image, Office, or plain-text files.`;
  }
  return null;
}
