import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// 비밀번호는 평문으로 저장하지 않는다. scrypt로 해시한 문자열만 DB에 둔다.
// 저장 형식: scrypt$<N>$<salt(base64)>$<hash(base64)>  (나중에 N을 올려도 옛 해시를 읽을 수 있다)
const N = 16384;
const KEYLEN = 64;

function derive(password: string, salt: Buffer, n: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, { N: n, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N);
  return `scrypt$${N}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, nText, saltText, hashText] = stored.split("$");
  const n = Number(nText);
  if (scheme !== "scrypt" || !Number.isInteger(n) || n < 1024 || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64");
  const actual = await derive(password, Buffer.from(saltText, "base64"), n);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
