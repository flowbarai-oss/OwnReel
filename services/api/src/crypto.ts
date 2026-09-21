import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export interface EncryptedValue {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

export class SecretBox {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new Error("SecretBox requires a 32-byte key");
  }

  encrypt(value: unknown, context: string): EncryptedValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(context));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return { ciphertext, iv, tag: cipher.getAuthTag() };
  }

  decrypt<T>(value: EncryptedValue, context: string): T {
    const decipher = createDecipheriv("aes-256-gcm", this.key, value.iv);
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(value.tag);
    const plaintext = Buffer.concat([decipher.update(value.ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8")) as T;
  }
}

export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest();
}

export function sha256Hex(value: string | Buffer) {
  return sha256(value).toString("hex");
}

export function opaqueToken() {
  return randomBytes(32).toString("base64url");
}
