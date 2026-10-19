const SESSION_SECONDS = 30 * 24 * 60 * 60;
const SESSION_RENEW_AFTER_SECONDS = 24 * 60 * 60;
function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}
function fromBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function hmac(secret, payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  );
}
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}
async function createSessionToken(userId, sessionVersion, secret, nowMs = Date.now()) {
  const payload = {
    userId,
    sessionVersion,
    exp: Math.floor(nowMs / 1e3) + SESSION_SECONDS
  };
  const encodedPayload = toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signature = await hmac(secret, encodedPayload);
  return `${encodedPayload}.${toBase64Url(signature)}`;
}
async function verifySessionToken(token, secret, nowMs = Date.now()) {
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;
  try {
    const expected = await hmac(secret, encodedPayload);
    const actual = fromBase64Url(encodedSignature);
    if (!constantTimeEqual(actual, expected)) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encodedPayload))
    );
    if (typeof payload.userId !== "string" || typeof payload.sessionVersion !== "number" || !Number.isInteger(payload.sessionVersion) || payload.sessionVersion < 1 || typeof payload.exp !== "number" || payload.exp <= Math.floor(nowMs / 1e3)) {
      return null;
    }
    return {
      userId: payload.userId,
      sessionVersion: payload.sessionVersion,
      exp: payload.exp
    };
  } catch {
    return null;
  }
}
function shouldRenewSession(payload, nowMs = Date.now()) {
  const nowSeconds = Math.floor(nowMs / 1e3);
  const remainingSeconds = payload.exp - nowSeconds;
  return remainingSeconds > 0 && remainingSeconds <= SESSION_SECONDS - SESSION_RENEW_AFTER_SECONDS;
}
const SESSION_MAX_AGE = SESSION_SECONDS;
export {
  SESSION_MAX_AGE,
  createSessionToken,
  shouldRenewSession,
  verifySessionToken
};