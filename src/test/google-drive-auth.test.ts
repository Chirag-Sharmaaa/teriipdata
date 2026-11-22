// @vitest-environment node

import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createGoogleDriveAccessToken,
  GOOGLE_DRIVE_AND_SHEETS_WRITE_SCOPE,
} from "@/lib/google-drive-auth.server";

describe("Google Drive service-account authentication", () => {
  it("exchanges a read-only signed assertion for an access token", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const fetcher: typeof fetch = async (input, init) => {
      expect(String(input)).toBe("https://oauth2.googleapis.com/token");
      expect(init?.method).toBe("POST");

      const body = new URLSearchParams(init?.body as string);
      expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");

      const assertion = body.get("assertion");
      expect(assertion).not.toBeNull();
      const [encodedHeader, encodedClaims, encodedSignature] = assertion!.split(".");
      const claims = JSON.parse(Buffer.from(encodedClaims!, "base64url").toString("utf8")) as {
        iss: string;
        scope: string;
        aud: string;
        iat: number;
        exp: number;
      };
      expect(claims).toMatchObject({
        iss: "reader@example.iam.gserviceaccount.com",
        scope: "https://www.googleapis.com/auth/drive.readonly",
        aud: "https://oauth2.googleapis.com/token",
      });
      expect(claims.exp - claims.iat).toBe(3600);

      const verifier = createVerify("RSA-SHA256");
      verifier.update(`${encodedHeader}.${encodedClaims}`);
      verifier.end();
      expect(verifier.verify(publicKey, Buffer.from(encodedSignature!, "base64url"))).toBe(true);

      return new Response(JSON.stringify({ access_token: "mock-access-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const token = await createGoogleDriveAccessToken(
      "reader@example.iam.gserviceaccount.com",
      privateKey.replace(/\n/g, "\\n"),
      fetcher,
    );

    expect(token).toBe("mock-access-token");
  });

  it("does not hide token-exchange failures", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    await expect(
      createGoogleDriveAccessToken(
        "reader@example.iam.gserviceaccount.com",
        privateKey,
        async () => new Response(null, { status: 401 }),
      ),
    ).rejects.toThrow("Google service-account token exchange failed (401).");
  });

  it("requests spreadsheet write access only for the append workflow", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const fetcher: typeof fetch = async (_input, init) => {
      const body = new URLSearchParams(init?.body as string);
      const assertion = body.get("assertion");
      const [, encodedClaims] = assertion!.split(".");
      const claims = JSON.parse(Buffer.from(encodedClaims!, "base64url").toString("utf8")) as {
        scope: string;
      };
      expect(claims.scope).toBe(GOOGLE_DRIVE_AND_SHEETS_WRITE_SCOPE);
      return Response.json({ access_token: "mock-write-token" });
    };

    await expect(
      createGoogleDriveAccessToken(
        "writer@example.iam.gserviceaccount.com",
        privateKey,
        fetcher,
        GOOGLE_DRIVE_AND_SHEETS_WRITE_SCOPE,
      ),
    ).resolves.toBe("mock-write-token");
  });
});
