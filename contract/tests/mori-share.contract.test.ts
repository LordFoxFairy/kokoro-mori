import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const contract = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "contract/openapi/mori-share.v1.json"),
    "utf8",
  ),
) as {
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<
      string,
      { properties?: Record<string, { enum?: string[] }> }
    >;
  };
};

describe("link-only share contract", () => {
  it("keeps share creation, recovery, and revocation explicit", () => {
    expect(contract.openapi).toBe("3.1.0");
    expect(
      contract.paths["/api/v1/mori/versions/{version_ref}/share"],
    ).toHaveProperty("post");
    expect(contract.paths["/api/v1/mori/shares/{share_ref}"]).toHaveProperty(
      "get",
    );
    expect(
      contract.paths["/api/v1/mori/shares/{share_ref}/revoke"],
    ).toHaveProperty("post");
  });

  it("models a revocable share without storing a token in the browser contract", () => {
    expect(contract.components.schemas.Share.properties?.status?.enum).toEqual([
      "creating",
      "active",
      "failed",
      "revoked",
    ]);
    expect(contract.components.schemas.Share.properties).toHaveProperty(
      "share_url",
    );
    expect(contract.components.schemas.Share.properties).not.toHaveProperty(
      "share_token",
    );
  });
});
