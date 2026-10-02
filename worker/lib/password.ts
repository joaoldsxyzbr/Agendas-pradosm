const CURRENT_ITERATIONS = 100_000;
const LEGACY_ITERATIONS = 100_000;
const HASH_BYTES = 32;
const SALT_BYTES = 16;
const SUPPORTED_ITERATIONS = new Set([
  LEGACY_ITERATIONS,
  600_000,
]);

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    key,
    HASH_BYTES * 8,
  );

  return new Uint8Array(bits);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}

function parsePasswordHash(encoded: string) {
  const [algorithm, iterationsText, saltText, hashText, extra] =
    encoded.split("$");
  const iterations = Number(iterationsText);

  if (
    algorithm !== "pbkdf2_sha256" ||
    extra !== undefined ||
    !Number.isInteger(iterations) ||
    !SUPPORTED_ITERATIONS.has(iterations) ||
    !saltText ||
    !hashText
  ) {
    return null;
  }

  try {
    const salt = fromBase64(saltText);
    const hash = fromBase64(hashText);
    if (salt.byteLength !== SALT_BYTES || hash.byteLength !== HASH_BYTES) {
      return null;
    }
    return { iterations, salt, hash };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, CURRENT_ITERATIONS);
  return `pbkdf2_sha256$${CURRENT_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const parsed = parsePasswordHash(encoded);
  if (!parsed) return false;

  try {
    const actual = await derive(password, parsed.salt, parsed.iterations);
    return constantTimeEqual(actual, parsed.hash);
  } catch {
    return false;
  }
}

export function passwordNeedsUpgrade(encoded: string): boolean {
  const parsed = parsePasswordHash(encoded);
  return Boolean(parsed && parsed.iterations < CURRENT_ITERATIONS);
}

export const PASSWORD_HASH_ITERATIONS = CURRENT_ITERATIONS;
