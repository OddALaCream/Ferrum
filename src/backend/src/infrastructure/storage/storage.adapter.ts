/** Puerto de almacenamiento (ADR-003). La app depende de esta abstracción, no de MinIO/S3. */
export abstract class StorageAdapter {
  abstract upload(key: string, body: Buffer, contentType: string): Promise<void>;
  abstract presignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  abstract remove(key: string): Promise<void>;
  /** Verifica que el bucket exista y sea accesible. */
  abstract ping(): Promise<void>;
}
