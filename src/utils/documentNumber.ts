/**
 * Structured document numbering scheme for the archive registry.
 *
 * Format: `{DEPT_CODE}-{TYPE_CODE}-{NNNN}` (e.g. ENG-ARCH-0001, FIN-INV-0042).
 * The prefix carries departmental + classification identity so records are
 * distinguishable at a glance; the zero-padded sequential suffix is scoped
 * per prefix, which keeps numbers unique across all departments and types
 * (document_number also carries a UNIQUE constraint in the database).
 */

/** Suffix width for the sequential counter (0001, 0002, ...). */
export const DOC_NUMBER_SUFFIX_WIDTH = 4;

/**
 * Normalize a code segment for use inside a document number: uppercase,
 * alphanumeric only, with a fallback when nothing usable remains.
 */
export function sanitizeCodeSegment(raw: string | null | undefined, fallback: string): string {
  const cleaned = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned || fallback;
}

/** Composite prefix from the department code + document type classification code. */
export function buildDocumentNumberPrefix(departmentCode?: string | null, documentTypeCode?: string | null): string {
  const dept = sanitizeCodeSegment(departmentCode, 'GEN');
  const type = sanitizeCodeSegment(documentTypeCode, 'DOC');
  return `${dept}-${type}`;
}

/**
 * Extract the trailing sequential suffix of a document number belonging to
 * the given prefix, or null when the number does not match `{prefix}-{digits}`.
 */
export function extractSuffix(prefix: string, documentNumber: string): number | null {
  const match = documentNumber.match(new RegExp(`^${prefix}-(\\d+)$`));
  if (!match) return null;
  return parseInt(match[1], 10);
}

/**
 * Given the numbers already in use, produce the next sequential number for
 * the prefix: max existing suffix + 1, zero-padded (grows past 9999 naturally).
 */
export function nextDocumentNumber(prefix: string, existingNumbers: Iterable<string>): string {
  let max = 0;
  for (const num of existingNumbers) {
    const suffix = extractSuffix(prefix, num);
    if (suffix !== null && suffix > max) max = suffix;
  }
  return `${prefix}-${String(max + 1).padStart(DOC_NUMBER_SUFFIX_WIDTH, '0')}`;
}
