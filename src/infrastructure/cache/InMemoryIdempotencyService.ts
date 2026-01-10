import { IIdempotencyService } from '../../domain/services/IIdempotencyService';

export class InMemoryIdempotencyService implements IIdempotencyService {
  private processed: Set<string> = new Set();
  private results: Map<string, any> = new Map();
  private readonly defaultTtl = 86400; // 24 horas

  async isProcessed(key: string): Promise<boolean> {
    return this.processed.has(key);
  }

  async getResult<T>(key: string): Promise<T | null> {
    return (this.results.get(key) as T) || null;
  }

  async markAsProcessed(key: string, ttl: number = this.defaultTtl, result?: any): Promise<void> {
    this.processed.add(key);

    if (result !== undefined) {
      this.results.set(key, result);
    }

    // Remove após TTL (simplificado para memória)
    if (ttl < Infinity) {
      setTimeout(() => {
        this.processed.delete(key);
        this.results.delete(key);
      }, ttl * 1000);
    }
  }

  async executeOnce<T>(
    key: string,
    operation: () => Promise<T>,
    ttl: number = this.defaultTtl
  ): Promise<T | null> {
    if (await this.isProcessed(key)) {
      return null;
    }

    const result = await operation();
    await this.markAsProcessed(key, ttl);

    return result;
  }
}
