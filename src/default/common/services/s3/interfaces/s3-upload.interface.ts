export interface UploadBase64ToS3Params {
  base64: string;
  fileName?: string;
  folder?: string;
  mimeType?: string;
  isPublic?: boolean;
  maxSizeInMB?: number;
  allowedMimeTypes?: string[];
}

export interface UploadBufferToS3Params {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folder?: string;
  isPublic?: boolean;
}

export interface UploadS3Response {
  key: string;
  url: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ProcessChunkUploadJob {
  uploadId: string;
  fileName: string;
  mimeType: string;
  folder?: string;
  totalChunks: number;
  isPublic?: boolean;
}
