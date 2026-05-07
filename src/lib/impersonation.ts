import { SignJWT, jwtVerify } from "jose";

export const IMPERSONATION_COOKIE = "cc_impersonate";
const ALG = "HS256";
const TTL_SECONDS = 60 * 60; // 1h

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export interface ImpersonationPayload {
  /** ID du user client impersonné */
  sub: number;
  /** ID du user admin/équipe à l'origine */
  as: number;
}

export async function signImpersonationToken(
  payload: ImpersonationPayload,
): Promise<string> {
  return await new SignJWT({ as: payload.as })
    .setProtectedHeader({ alg: ALG })
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyImpersonationToken(
  token: string,
): Promise<ImpersonationPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
    });
    const sub = payload.sub ? parseInt(payload.sub, 10) : NaN;
    const as = typeof payload.as === "number" ? payload.as : NaN;
    if (!Number.isFinite(sub) || !Number.isFinite(as)) return null;
    return { sub, as };
  } catch {
    return null;
  }
}

export const IMPERSONATION_TTL_SECONDS = TTL_SECONDS;
