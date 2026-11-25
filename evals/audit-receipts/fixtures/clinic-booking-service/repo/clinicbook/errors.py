"""Errors that map to an HTTP status. Anything else is reported as a 500."""


class AppError(Exception):
    status = 400
    code = "bad_request"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ValidationError(AppError):
    status = 400
    code = "invalid"


class Unauthorized(AppError):
    status = 401
    code = "unauthorized"


class Forbidden(AppError):
    status = 403
    code = "forbidden"


class NotFound(AppError):
    status = 404
    code = "not_found"


class MethodNotAllowed(AppError):
    status = 405
    code = "method_not_allowed"


class Conflict(AppError):
    status = 409
    code = "conflict"


class SlotTaken(Conflict):
    code = "slot_taken"


class LimitReached(Conflict):
    code = "limit_reached"
