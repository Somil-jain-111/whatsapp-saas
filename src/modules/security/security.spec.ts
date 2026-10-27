import { randomBytes } from "crypto";
import { FieldEncryptionService } from "./encryption/field-encryption.service";
import { PasswordHasherService } from "./password-hasher.service";
import { TokenVerifierService } from "./token-verifier.service";
import { PasswordHelper } from "src/default/common/helper/password.helper";

describe("security primitives", () => {
  it("creates and verifies Argon2id password hashes", async () => {
    const service = new PasswordHasherService();
    const hash = await service.hash("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(
      service.verify(hash, "correct horse battery staple"),
    ).resolves.toBe(true);
    await expect(service.verify(hash, "wrong")).resolves.toBe(false);
  });

  it("keeps the shared password helper on Argon2id", async () => {
    const hash = await PasswordHelper.hashPassword("shared-helper-password");
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(
      PasswordHelper.comparePassword("shared-helper-password", hash),
    ).resolves.toBe(true);
  });

  it("uses a keyed token verifier", () => {
    const service = new TokenVerifierService();
    const pepper = randomBytes(32);
    const digest = service.digest("single-use-secret", pepper);
    expect(digest).toHaveLength(64);
    expect(service.matches("single-use-secret", pepper, digest)).toBe(true);
    expect(service.matches("other", pepper, digest)).toBe(false);
    expect(() => service.digest("token", randomBytes(16))).toThrow(
      "at least 32 bytes",
    );
  });

  it("authenticates ciphertext and binds it to context", async () => {
    const key = randomBytes(32);
    const service = new FieldEncryptionService({
      current: async () => ({ key, version: "v1" }),
      byVersion: async () => key,
    });
    const encrypted = await service.encrypt(
      Buffer.from("mfa-secret"),
      "user:factor",
    );
    await expect(service.decrypt(encrypted, "user:factor")).resolves.toEqual(
      Buffer.from("mfa-secret"),
    );
    await expect(service.decrypt(encrypted, "other-factor")).rejects.toThrow();
  });
});
