import { supabase } from '../config/supabaseClient';

/**
 * The single upload path for course materials, announcement attachments and the
 * ExamGenerator syllabus/TOS/materials pickers.
 *
 * Before this module the app never read an uploaded File at all: ClassroomDetail built a
 * metadata-only object with a hard-coded `content` sentence, `fileUrl` was never set, and
 * the bytes were dropped on the floor. Nothing was viewable and nothing survived a reload.
 *
 * Unlike supabaseData.ts — which warns and swallows so the app degrades quietly — this
 * module THROWS. An upload is a foreground action the instructor is waiting on, so a failure
 * has to reach the UI instead of silently producing an empty attachment.
 */

export const CLASSROOM_FILES_BUCKET = 'classroom-files';

/**
 * Matches the bucket's file_size_limit set in
 * database/migration_002_materials_announcements_analytics.sql. Keep the two in sync.
 */
export const MAX_STORAGE_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Offline fallback ceiling. The data URL ends up in React state that AuthContext mirrors
 * into localStorage; base64 inflates by ~4/3, so a 2MB file becomes a ~2.7MB string against
 * a ~5MB per-origin quota. Anything larger must go to Storage or be refused outright.
 */
export const MAX_INLINE_DATA_URL_BYTES = 2 * 1024 * 1024;

export interface StoredFile {
  /** Public https URL from Supabase Storage, or a base64 data: URL in offline mode. */
  url: string;
  /** Object key inside the bucket; null when the file was inlined as a data URL. */
  storagePath: string | null;
  isDataUrl: boolean;
  name: string;
  size: number;
  mimeType: string;
}

export class FileUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileUploadError';
  }
}

/** Honest byte formatter. Returns a dash for unknown sizes rather than inventing one. */
export function formatBytes(bytes?: number | null): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Lowercased extension without the dot, e.g. 'pdf'. Empty string when there is none. */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

/**
 * Strip a filename down to something safe as a Storage object key segment. Supabase keys
 * are URL path segments, so anything outside [A-Za-z0-9._-] is collapsed to an underscore.
 */
function sanitizeObjectName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+/, '');
  // Keep keys short; Storage accepts long keys but they are unwieldy in the dashboard.
  const trimmed = cleaned.slice(-120);
  return trimmed || 'file';
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new FileUploadError(`Could not read "${file.name}" as a data URL.`));
    };
    reader.onerror = () =>
      reject(new FileUploadError(`Could not read "${file.name}" (${reader.error?.message || 'unknown read error'}).`));
    reader.onabort = () => reject(new FileUploadError(`Reading "${file.name}" was aborted.`));
    reader.readAsDataURL(file);
  });
}

async function inlineAsDataUrl(file: File, reason: string): Promise<StoredFile> {
  if (file.size > MAX_INLINE_DATA_URL_BYTES) {
    throw new FileUploadError(
      `"${file.name}" is ${formatBytes(file.size)}. ${reason} ` +
        `Files stored in the browser are limited to ${formatBytes(MAX_INLINE_DATA_URL_BYTES)}. ` +
        `Configure Supabase storage (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) to upload larger files.`
    );
  }
  const url = await readFileAsDataUrl(file);
  return {
    url,
    storagePath: null,
    isDataUrl: true,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
  };
}

/**
 * Upload a file for a classroom and return a durable reference to it.
 *
 * Supabase configured -> uploads to the public `classroom-files` bucket and returns its
 * public URL. Not configured, or the upload failed -> falls back to a base64 data URL when
 * the file is small enough, so the feature still works on a laptop with no backend.
 *
 * @throws {FileUploadError} when the file is too large for whichever path is available.
 */
export async function uploadClassroomFile(classroomId: string, file: File): Promise<StoredFile> {
  if (!file) throw new FileUploadError('No file was provided.');

  if (!supabase) {
    return inlineAsDataUrl(file, 'Supabase storage is not configured, so it has to be stored in this browser.');
  }

  if (file.size > MAX_STORAGE_UPLOAD_BYTES) {
    throw new FileUploadError(
      `"${file.name}" is ${formatBytes(file.size)}, which exceeds the ` +
        `${formatBytes(MAX_STORAGE_UPLOAD_BYTES)} upload limit.`
    );
  }

  // Collision-proof key: a uuid segment means two uploads of the same filename, or a rapid
  // double-submit, can never overwrite each other.
  const objectPath = `classrooms/${classroomId || 'unassigned'}/${crypto.randomUUID()}-${sanitizeObjectName(file.name)}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from(CLASSROOM_FILES_BUCKET)
      .upload(objectPath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(CLASSROOM_FILES_BUCKET).getPublicUrl(objectPath);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) {
      throw new Error('Storage returned no public URL — is the `classroom-files` bucket marked public?');
    }

    return {
      url: publicUrl,
      storagePath: objectPath,
      isDataUrl: false,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    };
  } catch (e: any) {
    const detail = e?.message || String(e);
    console.warn('[fileStorage] Storage upload failed, attempting inline fallback:', detail);
    // A missing bucket, an RLS refusal or a dropped connection should not lose the
    // instructor's file if it is small enough to keep locally.
    return inlineAsDataUrl(file, `Uploading to Supabase storage failed (${detail}).`);
  }
}

/**
 * Best-effort removal of a stored object. Deliberately non-throwing: the caller has already
 * removed the row the user cares about, and a leaked object is far less bad than an error
 * dialog on a successful delete.
 */
export async function removeClassroomFile(storagePath?: string | null): Promise<void> {
  if (!supabase || !storagePath) return;
  try {
    const { error } = await supabase.storage.from(CLASSROOM_FILES_BUCKET).remove([storagePath]);
    if (error) console.warn('[fileStorage] removeClassroomFile failed:', error);
  } catch (e) {
    console.warn('[fileStorage] removeClassroomFile threw:', e);
  }
}
