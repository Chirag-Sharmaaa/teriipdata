import { createHmac, randomUUID } from "node:crypto";

const TOKEN_LIFETIME_SECONDS = 5 * 60;

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

export function createExtractionToken(
  secret: string,
  userId: string,
  centreKey: string,
  now = Date.now(),
) {
  if (Buffer.byteLength(secret) < 32) {
    throw new Error("The extraction token secret must be at least 32 bytes.");
  }
  const issuedAt = Math.floor(now / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: "teriip",
      aud: "teriip-extraction",
      sub: userId,
      centre_key: centreKey,
      iat: issuedAt,
      exp: issuedAt + TOKEN_LIFETIME_SECONDS,
      jti: randomUUID(),
    }),
  );
  const unsignedToken = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(unsignedToken).digest("base64url");
  return `${unsignedToken}.${signature}`;
}
