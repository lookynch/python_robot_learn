import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { beforeAll, describe, expect, test } from 'vitest';
import { emptyProgress } from '../../src/learning/progress';
import { handleProgress, type Env } from '../../server/progress';

class FakeD1 {
  rows = new Map<string, { version: number; data: string; updated_at: number }>();
  failNextUpdate = false;

  prepare(sql: string) {
    let params: unknown[] = [];
    const statement = {
      bind: (...values: unknown[]) => {
        params = values;
        return statement;
      },
      first: async () => {
        const row = this.rows.get(params[0] as string);
        return row ? { version: row.version, data: row.data } : null;
      },
      run: async () => {
        if (sql.startsWith('CREATE')) return { meta: { changes: 0 } };
        if (sql.startsWith('INSERT')) {
          const [user, data, at] = params as [string, string, number];
          if (this.rows.has(user)) return { meta: { changes: 0 } };
          this.rows.set(user, { version: 1, data, updated_at: at });
          return { meta: { changes: 1 } };
        }
        const [version, data, at, user, expected] = params as [
          number,
          string,
          number,
          string,
          number,
        ];
        const row = this.rows.get(user);
        if (this.failNextUpdate) {
          this.failNextUpdate = false;
          this.rows.set(user, { ...row!, version: row!.version + 1 });
          return { meta: { changes: 0 } };
        }
        if (!row || row.version !== expected) return { meta: { changes: 0 } };
        this.rows.set(user, { version, data, updated_at: at });
        return { meta: { changes: 1 } };
      },
    };
    return statement;
  }
}

const TEAM = 'team.cloudflareaccess.com';
const AUD = 'aud-123';
let jwks: ReturnType<typeof createLocalJWKSet>;
let privateKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey as CryptoKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };
  jwks = createLocalJWKSet({ keys: [jwk] });
});

async function token(
  claims: Record<string, unknown> = {},
  options: { aud?: string; iss?: string; exp?: string } = {},
) {
  return new SignJWT({ email: 'ich@example.com', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject((claims.sub as string) ?? 'user-1')
    .setAudience(options.aud ?? AUD)
    .setIssuer(options.iss ?? `https://${TEAM}`)
    .setIssuedAt()
    .setExpirationTime(options.exp ?? '1h')
    .sign(privateKey);
}

function env(db = new FakeD1()): Env & { DB: FakeD1 } {
  return {
    DB: db as unknown as D1Database & FakeD1,
    ACCESS_TEAM_DOMAIN: TEAM,
    ACCESS_AUD: AUD,
  } as Env & { DB: FakeD1 };
}

function post(body: unknown, jwt: string | null, origin = 'https://app.example') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: origin };
  if (jwt) headers['Cf-Access-Jwt-Assertion'] = jwt;
  return new Request('https://app.example/api/progress', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const call = (request: Request, e: Env) => handleProgress(request, e, () => jwks);
const body = async (r: Response) =>
  (await r.json()) as { progress: { activity: string[] }; version: number };

describe('Sync-Function', () => {
  test('ohne D1 oder Access-Konfiguration: 503', async () => {
    expect((await call(post({}, null), {})).status).toBe(503);
    expect((await call(post({}, null), { DB: new FakeD1() as unknown as D1Database })).status).toBe(
      503,
    );
  });

  test('ohne, mit falschem oder abgelaufenem Token: 401', async () => {
    const e = env();
    expect((await call(post({ progress: emptyProgress() }, null), e)).status).toBe(401);
    expect(
      (await call(post({ progress: emptyProgress() }, await token({}, { aud: 'fremd' })), e))
        .status,
    ).toBe(401);
    expect(
      (
        await call(
          post({ progress: emptyProgress() }, await token({}, { iss: 'https://boese.example' })),
          e,
        )
      ).status,
    ).toBe(401);
    expect(
      (await call(post({ progress: emptyProgress() }, await token({}, { exp: '-1m' })), e)).status,
    ).toBe(401);
    expect(
      (await call(post({ progress: emptyProgress() }, await token({ sub: '' })), e)).status,
    ).toBe(401);
  });

  test('fremde Herkunft: 403, falscher Inhaltstyp: 415', async () => {
    const e = env();
    expect(
      (await call(post({ progress: emptyProgress() }, await token(), 'https://boese.example'), e))
        .status,
    ).toBe(403);
    const request = new Request('https://app.example/api/progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        Origin: 'https://app.example',
        'Cf-Access-Jwt-Assertion': await token(),
      },
      body: '{}',
    });
    expect((await call(request, e)).status).toBe(415);
  });

  test('speichert, merged und trennt Nutzer', async () => {
    const e = env();
    const a = { ...emptyProgress(), activity: ['2026-10-01'] };
    const first = await call(post({ progress: a }, await token()), e);
    expect(first.status).toBe(200);
    const b = { ...emptyProgress(), activity: ['2026-10-02'] };
    const second = await body(await call(post({ progress: b }, await token()), e));
    expect(second.progress.activity).toEqual(['2026-10-01', '2026-10-02']);
    expect(second.version).toBe(2);
    const other = await body(
      await call(post({ progress: emptyProgress() }, await token({ sub: 'user-2' })), e),
    );
    expect(other.progress.activity).toEqual([]);
  });

  test('Versionskonflikt wird durch erneutes Lesen und Mergen gelöst', async () => {
    const e = env();
    await call(post({ progress: emptyProgress() }, await token()), e);
    e.DB.failNextUpdate = true;
    const response = await call(
      post({ progress: { ...emptyProgress(), activity: ['2026-10-03'] } }, await token()),
      e,
    );
    expect(response.status).toBe(200);
    expect((await body(response)).version).toBe(3);
  });

  test('ältere App-Version darf neuere Daten nicht überschreiben: 409', async () => {
    const e = env();
    await call(post({ progress: { ...emptyProgress(), schemaVersion: 2 } }, await token()), e);
    expect((await call(post({ progress: emptyProgress() }, await token()), e)).status).toBe(409);
  });

  test('Dev-Bypass gilt nur lokal und nur mit ENVIRONMENT=dev', async () => {
    const devEnv = {
      DB: new FakeD1() as unknown as D1Database,
      ENVIRONMENT: 'dev',
      DEV_FAKE_USER: 'dev@local',
    };
    const local = new Request('http://localhost:8788/api/progress');
    expect((await call(local, devEnv)).status).toBe(200);
    const remote = new Request('https://robopy.pages.dev/api/progress');
    expect((await call(remote, devEnv)).status).toBe(503);
    expect(
      (await call(remote, { ...devEnv, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD })).status,
    ).toBe(401);
    expect((await call(local, { ...devEnv, ENVIRONMENT: 'production' })).status).toBe(503);
  });
});
