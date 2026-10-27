import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";

@Injectable()
export class R2Service {
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly cdnBaseUrl: string;

  constructor(config: ConfigService) {
    const accountId = config.get<string>("R2_ACCOUNT_ID") || "";
    const accessKeyId = config.get<string>("R2_ACCESS_KEY_ID") || "";
    const secretAccessKey = config.get<string>("R2_SECRET_ACCESS_KEY") || "";
    this.bucket = config.get<string>("R2_BUCKET_NAME") || "";
    this.cdnBaseUrl = (config.get<string>("R2_CDN_BASE_URL") || "").replace(
      /\/$/,
      "",
    );
    const endpoint =
      config.get<string>("R2_ENDPOINT") ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
    this.client =
      endpoint && accessKeyId && secretAccessKey && this.bucket
        ? new S3Client({
            region: "auto",
            endpoint,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  private configured(): S3Client {
    if (!this.client)
      throw new ServiceUnavailableException("Cloudflare R2 is not configured");
    return this.client;
  }

  createPresignedPutUrl(key: string, mimeType: string): Promise<string> {
    return getSignedUrl(
      this.configured(),
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
      }),
      { expiresIn: 900 },
    );
  }

  async createMultipartUpload(key: string, mimeType: string): Promise<string> {
    const result = await this.configured().send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
      }),
    );
    if (!result.UploadId)
      throw new ServiceUnavailableException("R2 multipart upload failed");
    return result.UploadId;
  }

  createPresignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
  ): Promise<string> {
    return getSignedUrl(
      this.configured(),
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: 900 },
    );
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<void> {
    await this.configured().send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((part) => ({
            ETag: part.etag,
            PartNumber: part.partNumber,
          })),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.configured().send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  async getObjectMetadata(
    key: string,
  ): Promise<{ size: number; mimeType: string }> {
    const result = await this.configured().send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return {
      size: Number(result.ContentLength || 0),
      mimeType: result.ContentType || "",
    };
  }

  async getObjectPrefix(key: string, maxBytes = 8192): Promise<Buffer> {
    const result = await this.configured().send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: `bytes=0-${maxBytes - 1}`,
      }),
    );
    if (!result.Body)
      throw new ServiceUnavailableException("R2 object is empty");
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async getObjectStream(key: string): Promise<Readable> {
    const result = await this.configured().send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body)
      throw new ServiceUnavailableException("R2 object is empty");
    return result.Body as Readable;
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const result = await this.configured().send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body)
      throw new ServiceUnavailableException("R2 object is empty");
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async putObject(
    key: string,
    body: Buffer,
    mimeType: string,
    cacheControl?: string,
  ): Promise<void> {
    await this.configured().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        CacheControl: cacheControl,
      }),
    );
  }

  async deleteFile(key: string): Promise<void> {
    await this.configured().send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  getCdnUrl(key: string): string {
    if (!this.cdnBaseUrl) {
      throw new ServiceUnavailableException(
        "Cloudflare R2 CDN URL is not configured",
      );
    }
    const path = key
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${this.cdnBaseUrl}/${path}`;
  }
}
