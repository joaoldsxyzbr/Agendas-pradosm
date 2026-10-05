export type SessionPayload = {
  userId: string;
  sessionVersion: number;
  exp: number;
};

const SESSION_SECONDS = 30 * 24 * 60 * 60;
const SESSION_RENEW_AFTER_SECONDS = 24 * 60 * 60;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(secret: string, payload: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
  );
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}

export async function createSessionToken(
  userId: string,
  sessionVersion: number,
  secret: string,
  nowMs = Date.now(),
): Promise<string> {
  const payload: SessionPayload = {
    userId,
    sessionVersion,
    exp: Math.floor(nowMs / 1000) + SESSION_SECONDS,
  };
  const encodedPayload = toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await hmac(secret, encodedPayload);
  return `${encodedPayload}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  nowMs = Date.now(),
): Promise<SessionPayload | null> {
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;

  try {
    const expected = await hmac(secret, encodedPayload);
    const actual = fromBase64Url(encodedSignature);
    if (!constantTimeEqual(actual, expected)) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encodedPayload)),
    ) as Partial<SessionPayload>;

    if (
      typeof payload.userId !== "string" ||
      typeof payload.sessionVersion !== "number" ||
      !Number.isInteger(payload.sessionVersion) ||
      payload.sessionVersion < 1 ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(nowMs / 1000)
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      sessionVersion: payload.sessionVersion,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function shouldRenewSession(
  payload: SessionPayload,
  nowMs = Date.now(),
): boolean {
  const nowSeconds = Math.floor(nowMs / 1000);
  const remainingSeconds = payload.exp - nowSeconds;
  return (
    remainingSeconds > 0 &&
    remainingSeconds <= SESSION_SECONDS - SESSION_RENEW_AFTER_SECONDS
  );
}

export const SESSION_MAX_AGE = SESSION_SECONDS;
