import type { JWTVerifyGetKey } from 'jose';
import {
  mergeProgress,
  normalizeProgress,
  SCHEMA_VERSION,
  type Progress,
} from '../src/learning/progress';
import { authenticate, AuthError, type AuthEnv } from './access';

export interface Env extends AuthEnv {
  DB?: D1Database;
}

export const MAX_BODY_BYTES = 1_000_000;
const MAX_ATTEMPTS = 4;

interface Row {
  version: number;
  data: string;
}

let schemaReady: Promise<unknown> | null = null;

function ensureSchema(db: D1Database) {
  schemaReady ??= db
    .prepare(
      'CREATE TABLE IF NOT EXISTS progress (user_id TEXT PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL)',
    )
    .run()
    .catch((error: unknown) => {
      schemaReady = null;
      throw error;
    });
  return schemaReady;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return origin !== null && origin === new URL(request.url).origin;
}

async function readRow(db: D1Database, userId: string): Promise<Row | null> {
  return db
    .prepare('SELECT version, data FROM progress WHERE user_id = ?')
    .bind(userId)
    .first<Row>();
}

async function saveMerged(
  db: D1Database,
  userId: string,
  incoming: Progress,
): Promise<{ progress: Progress; version: number } | 'outdated'> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const row = await readRow(db, userId);
    const stored = row ? normalizeProgress(JSON.parse(row.data)) : null;
    if (stored && stored.schemaVersion > incoming.schemaVersion) return 'outdated';
    const merged = stored ? mergeProgress(incoming, stored) : incoming;
    const data = JSON.stringify(merged);
    const now = Date.now();
    const result = row
      ? await db
          .prepare(
            'UPDATE progress SET version = ?, data = ?, updated_at = ? WHERE user_id = ? AND version = ?',
          )
          .bind(row.version + 1, data, now, userId, row.version)
          .run()
      : await db
          .prepare(
            'INSERT INTO progress (user_id, version, data, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(user_id) DO NOTHING',
          )
          .bind(userId, data, now)
          .run();
    if (result.meta.changes === 1) return { progress: merged, version: row ? row.version + 1 : 1 };
  }
  throw new Error('Zu viele gleichzeitige Schreibzugriffe.');
}

export async function handleProgress(
  request: Request,
  env: Env,
  keys?: (origin: string) => JWTVerifyGetKey,
): Promise<Response> {
  if (!env.DB) return json({ error: 'not_configured', message: 'D1-Binding „DB“ fehlt.' }, 503);
  let identity;
  try {
    identity = await authenticate(request, env, keys);
  } catch (error) {
    if (error instanceof AuthError)
      return json(
        { error: error.status === 401 ? 'unauthorized' : 'not_configured', message: error.message },
        error.status,
      );
    throw error;
  }
  await ensureSchema(env.DB);

  if (request.method === 'GET') {
    const row = await readRow(env.DB, identity.userId);
    return json({
      progress: row ? JSON.parse(row.data) : null,
      version: row?.version ?? 0,
      email: identity.email,
    });
  }

  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!sameOrigin(request)) return json({ error: 'forbidden', message: 'Fremde Herkunft.' }, 403);
  if (!(request.headers.get('Content-Type') ?? '').startsWith('application/json'))
    return json({ error: 'unsupported_media_type' }, 415);
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad_request', message: 'Kein gültiges JSON.' }, 400);
  }
  const raw = (body as { progress?: unknown } | null)?.progress;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return json({ error: 'bad_request', message: 'progress fehlt.' }, 400);
  const incoming = normalizeProgress(raw);
  if (incoming.schemaVersion > SCHEMA_VERSION + 10)
    return json({ error: 'bad_request', message: 'Unbekannte Schemaversion.' }, 400);

  const saved = await saveMerged(env.DB, identity.userId, incoming);
  if (saved === 'outdated')
    return json({ error: 'client_outdated', message: 'Bitte App aktualisieren.' }, 409);
  return json({ ...saved, email: identity.email });
}
