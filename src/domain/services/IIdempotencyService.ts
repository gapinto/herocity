/**
 * Serviço de idempotência para prevenir processamento duplicado
 */
export interface IIdempotencyService {
  /**
   * Verifica se uma operação já foi processada
   * @param key Chave única da operação (ex: paymentId, orderId, webhookEventId)
   * @returns true se já foi processado, false caso contrário
   */
  isProcessed(key: string): Promise<boolean>;

  /**
   * Obtém resultado de uma operação já processada (se armazenado)
   * @param key Chave única da operação
   * @returns Resultado armazenado ou null se não existe
   */
  getResult<T>(key: string): Promise<T | null>;

  /**
   * Marca uma operação como processada
   * @param key Chave única da operação
   * @param ttl TTL em segundos (opcional, default: 24 horas)
   * @param result Resultado a ser armazenado (opcional, para cache de resultados)
   */
  markAsProcessed(key: string, ttl?: number, result?: any): Promise<void>;

  /**
   * Executa uma operação de forma idempotente
   * @param key Chave única da operação
   * @param operation Função a ser executada (só executa se não foi processado)
   * @param ttl TTL em segundos (opcional)
   * @returns Resultado da operação ou null se já foi processado
   */
  executeOnce<T>(
    key: string,
    operation: () => Promise<T>,
    ttl?: number
  ): Promise<T | null>;
}
