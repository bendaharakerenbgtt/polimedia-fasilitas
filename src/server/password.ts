import { hash, verify } from "@node-rs/argon2";

// Parameter Argon2id mengikuti rekomendasi OWASP (m=19MiB, t=2, p=1).
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string) {
  return hash(plain, OPTS);
}

export async function verifyPassword(hashed: string, plain: string) {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

export const PASSWORD_MIN_LENGTH = 8;
