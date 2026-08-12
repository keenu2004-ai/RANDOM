import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import crypto from 'crypto';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const access = promisify(fs.access);

export interface DocumentStorageOptions {
  provider: string;
  rootPath: string;
}

export class DocumentStorageService {
  private options: DocumentStorageOptions;

  constructor() {
    this.options = {
      provider: process.env.DOCUMENT_STORAGE_PROVIDER || 'local',
      rootPath: process.env.DOCUMENT_STORAGE_ROOT || path.join(process.cwd(), 'uploads', 'documents'),
    };
  }

  /**
   * Initializes the root storage directory if using local storage.
   */
  async init() {
    if (this.options.provider === 'local') {
      try {
        await mkdir(this.options.rootPath, { recursive: true });
      } catch (err) {
        console.error('Failed to create local document storage root:', err);
      }
    }
  }

  /**
   * Generates a secure, unpredictable storage key for a file.
   */
  generateStorageKey(orgId: string, empId: string, docId: string, version: number, extension: string): string {
    const randomHash = crypto.randomBytes(16).toString('hex');
    const safeExt = extension.startsWith('.') ? extension : `.${extension}`;
    return `${orgId}/${empId || 'org'}/${docId}/v${version}_${randomHash}${safeExt}`;
  }

  /**
   * Stores a file buffer to the underlying storage.
   */
  async upload(storageKey: string, fileBuffer: Buffer): Promise<void> {
    if (this.options.provider === 'local') {
      const fullPath = path.join(this.options.rootPath, storageKey);
      const dir = path.dirname(fullPath);
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, fileBuffer);
    } else {
      throw new Error(`Storage provider ${this.options.provider} not implemented.`);
    }
  }

  /**
   * Returns a readable stream for a given storage key.
   * Note: Returning a string path for local, but a real stream is better.
   * For simplicity in this implementation, we return the absolute path for local files.
   * If S3, it would return a stream or a signed URL.
   */
  async getFilePath(storageKey: string): Promise<string> {
    if (this.options.provider === 'local') {
      const fullPath = path.join(this.options.rootPath, storageKey);
      await access(fullPath, fs.constants.R_OK); // Throws if not accessible
      return fullPath;
    }
    throw new Error(`Storage provider ${this.options.provider} not implemented.`);
  }

  /**
   * Retrieves the raw buffer (useful for small files or base64 conversion if needed).
   */
  async getBuffer(storageKey: string): Promise<Buffer> {
    if (this.options.provider === 'local') {
      const fullPath = path.join(this.options.rootPath, storageKey);
      return fs.promises.readFile(fullPath);
    }
    throw new Error(`Storage provider ${this.options.provider} not implemented.`);
  }

  /**
   * Deletes a file from storage.
   */
  async delete(storageKey: string): Promise<void> {
    if (this.options.provider === 'local') {
      const fullPath = path.join(this.options.rootPath, storageKey);
      try {
        await unlink(fullPath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    } else {
      throw new Error(`Storage provider ${this.options.provider} not implemented.`);
    }
  }

  /**
   * Checks if a file exists.
   */
  async exists(storageKey: string): Promise<boolean> {
    if (this.options.provider === 'local') {
      const fullPath = path.join(this.options.rootPath, storageKey);
      try {
        await access(fullPath, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export const documentStorageService = new DocumentStorageService();
