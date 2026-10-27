import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable, NotFoundException } from "@nestjs/common";
import { createReadStream, promises as fs } from "fs";
import { dirname, resolve } from "path";
import { Readable } from "stream";
import { AppConfigService } from "../../default/config/config.service";

@Injectable()
export class PrivateObjectStorageService {
  private readonly root = resolve(process.cwd(), ".private-storage");
  private readonly bucket?: string;
  private readonly client?: S3Client;

  constructor(private readonly config: AppConfigService) {
    const region = config.get<string>("AWS_REGION");
    const accessKeyId = config.get<string>("AWS_ACCESS_KEY_ID");
    const secretAccessKey = config.get<string>("AWS_SECRET_ACCESS_KEY");
    this.bucket = config.get<string>("AWS_S3_BUCKET_NAME") || undefined;
    if (region && accessKeyId && secretAccessKey && this.bucket)
      this.client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
  }

  async putBuffer(key: string, body: Buffer, contentType: string) {
    if (this.client && this.bucket) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ServerSideEncryption: "AES256",
        }),
      );
      return key;
    }
    const path = this.path(key);
    await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await fs.writeFile(path, body, { mode: 0o600 });
    return key;
  }

  async putFile(key: string, path: string, contentType: string) {
    if (this.client && this.bucket) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: createReadStream(path),
          ContentType: contentType,
          ServerSideEncryption: "AES256",
        }),
      );
      return key;
    }
    const target = this.path(key);
    await fs.mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await fs.copyFile(path, target);
    await fs.chmod(target, 0o600);
    return key;
  }

  async readBuffer(key: string) {
    if (this.client && this.bucket) {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!result.Body) throw new NotFoundException("Stored file not found");
      return Buffer.from(await result.Body.transformToByteArray());
    }
    try {
      return await fs.readFile(this.path(key));
    } catch (error: any) {
      if (error?.code === "ENOENT")
        throw new NotFoundException("Stored file not found");
      throw error;
    }
  }

  async stream(key: string): Promise<Readable> {
    if (this.client && this.bucket) {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!result.Body) throw new NotFoundException("Stored file not found");
      return result.Body as Readable;
    }
    try {
      await fs.access(this.path(key));
      return createReadStream(this.path(key));
    } catch (error: any) {
      if (error?.code === "ENOENT")
        throw new NotFoundException("Stored file not found");
      throw error;
    }
  }

  private path(key: string) {
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}/`))
      throw new Error("Invalid object key");
    return path;
  }
}
