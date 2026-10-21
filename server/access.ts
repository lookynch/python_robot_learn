import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface AuthEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ENVIRONMENT?: string;
  DEV_FAKE_USER?: string;
}

export interface Identity {
  userId: string;
  email: string | null;
}

export class AuthError extends Error {
  constructor(
    public status: 401 | 503,
    message: string,
  ) {
    super(message);
  }
}

const keySets = new Map<string, JWTVerifyGetKey>();

export function teamOrigin(domain: string): string {
  const host = domain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  return `https://${host}`;
}

function remoteKeys(origin: string): JWTVerifyGetKey {
  let keys = keySets.get(origin);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${origin}/cdn-cgi/access/certs`));
    keySets.set(origin, keys);
  }
  return keys;
}

function isLocalhost(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

export async function authenticate(
  request: Request,
  env: AuthEnv,
  keys: (origin: string) => JWTVerifyGetKey = remoteKeys,
): Promise<Identity> {
  const url = new URL(request.url);
  if (env.ENVIRONMENT === 'dev' && env.DEV_FAKE_USER && isLocalhost(url)) {
    return { userId: `dev:${env.DEV_FAKE_USER}`, email: env.DEV_FAKE_USER };
  }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    throw new AuthError(
      503,
      'Cloudflare Access ist nicht konfiguriert (ACCESS_TEAM_DOMAIN / ACCESS_AUD fehlen).',
    );
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new AuthError(401, 'Kein Access-Token – bitte anmelden.');
  const origin = teamOrigin(env.ACCESS_TEAM_DOMAIN);
  try {
    const { payload } = await jwtVerify(token, keys(origin), {
      issuer: origin,
      audience: env.ACCESS_AUD,
      algorithms: ['RS256'],
    });
    if (typeof payload.sub !== 'string' || payload.sub === '')
      throw new AuthError(401, 'Token ohne Nutzerkennung.');
    const email = typeof payload.email === 'string' ? payload.email : null;
    return { userId: payload.sub, email };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(401, 'Access-Token ungültig oder abgelaufen.');
  }
}
