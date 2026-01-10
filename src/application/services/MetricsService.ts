export class MetricsService {
  private metrics: Map<string, number> = new Map();
  private timers: Map<string, number> = new Map();

  increment(metric: string, value: number = 1): void {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }

  decrement(metric: string, value: number = 1): void {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, Math.max(0, current - value));
  }

  set(metric: string, value: number): void {
    this.metrics.set(metric, value);
  }

  get(metric: string): number {
    return this.metrics.get(metric) || 0;
  }

  startTimer(metric: string): void {
    this.timers.set(metric, Date.now());
  }

  endTimer(metric: string): void {
    const start = this.timers.get(metric);
    if (start) {
      const duration = Date.now() - start;
      this.increment(`${metric}.duration`, duration);
      this.timers.delete(metric);
    }
  }

  getAllMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    this.metrics.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  reset(): void {
    this.metrics.clear();
    this.timers.clear();
  }

  // Métricas específicas do domínio
  recordOrderCreated(restaurantId: string): void {
    this.increment('orders.created');
    this.increment(`restaurant.${restaurantId}.orders.created`);
  }

  recordOrderCompleted(_orderId: string, duration: number): void {
    this.increment('orders.completed');
    this.increment('orders.completion_time', duration);
  }

  recordIntentIdentified(intent: string): void {
    this.increment('intents.identified');
    this.increment(`intents.${intent}`);
  }

  recordMessageReceived(userContext: string): void {
    this.increment('messages.received');
    this.increment(`messages.${userContext}`);
  }
}

export const metricsService = new MetricsService();

