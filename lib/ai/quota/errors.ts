export class AiQuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiQuotaExceededError';
  }
}
