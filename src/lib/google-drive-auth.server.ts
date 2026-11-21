const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DRIVE_READ_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function encodeJson(value: unknown) {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function privateKeyToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function createGoogleDriveAccessToken(
  serviceAccountEmail: string,
  privateKeyPem: string,
  fetcher: typeof fetch = fetch,
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const encodedHeader = encodeJson({ alg: "RS256", typ: "JWT" });
  const encodedClaims = encodeJson({
    iss: serviceAccountEmail,
    scope: DRIVE_READ_SCOPE,
    aud: GOOGLE_TOKEN_ENDPOINT,
    iat: issuedAt,
    exp: issuedAt + 3600,
  });
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signingKey = await globalThis.crypto.subtle.importKey(
    "pkcs8",
    privateKeyToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;

  const response = await fetcher(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google service-account token exchange failed (${response.status}).`);
  }

  const tokenData = (await response.json()) as { access_token?: unknown };
  if (typeof tokenData.access_token !== "string" || !tokenData.access_token) {
    throw new Error("Google token response did not include an access token.");
  }
  return tokenData.access_token;
}
