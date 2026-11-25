// Errors the domain raises. The API turns each into a response with its status and code.

export class DomainError extends Error {
  constructor(message, { code = "error", status = 400, details } = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message, details) {
    super(message, { code: "invalid_request", status: 400, details });
  }
}

export class NotFoundError extends DomainError {
  constructor(what) {
    super(`${what} not found`, { code: "not_found", status: 404 });
  }
}

export class ConflictError extends DomainError {
  constructor(message, code = "conflict", details) {
    super(message, { code, status: 409, details });
  }
}

export class OutOfStockError extends ConflictError {
  constructor(productId) {
    super("There isn't enough stock for this item", "out_of_stock", { productId });
  }
}

export class CouponError extends DomainError {
  constructor(message, code) {
    super(message, { code, status: 422 });
  }
}
