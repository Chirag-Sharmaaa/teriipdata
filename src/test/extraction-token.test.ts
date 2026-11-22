import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createExtractionToken } from "@/lib/extraction-token.server";

describe("short-lived extraction tokens", () => {
  it("signs the authorized user and centre for a five-minute lifetime", () => {
    const secret = "a".repeat(43);
    const now = 1_800_000_000_000;
    const token = createExtractionToken(secret, "user-123", "aiims_bathinda", now);
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    const header = JSON.parse(Buffer.from(encodedHeader!, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(encodedPayload!, "base64url").toString("utf8"));
    const expectedSignature = createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64url");

    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(payload).toMatchObject({
      iss: "teriip",
      aud: "teriip-extraction",
      sub: "user-123",
      centre_key: "aiims_bathinda",
      iat: now / 1000,
      exp: now / 1000 + 300,
    });
    expect(payload.jti).toEqual(expect.any(String));
    expect(encodedSignature).toBe(expectedSignature);
  });

  it("refuses a short signing secret", () => {
    expect(() => createExtractionToken("short", "user-123", "aiims_bathinda")).toThrow(
      "at least 32 bytes",
    );
  });
});
