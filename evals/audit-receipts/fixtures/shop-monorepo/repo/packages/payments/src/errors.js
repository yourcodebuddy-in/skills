export class ProviderError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}
