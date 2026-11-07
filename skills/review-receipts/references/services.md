# Servers, APIs, auth, jobs, queues, caches

- **Authorization:** is permission checked for this exact tenant, object, field, and action, not just "is signed in"? Compare with neighboring endpoints.
- **Trust boundary:** where is outside input validated, and can it reach a query, command, path, redirect, template, or deserializer unsafely?
- **Limits:** are input size, page size, fan-out, recursion, and expensive parsing bounded?
- **Leaks:** can secrets, personal data, or internal errors escape through responses, logs, analytics, or caches?
- **Idempotency:** what happens when a request or job runs twice, arrives out of order, or resumes after partial success?
- **Check then act:** can two callers both pass a check before either writes? Is there an atomic operation, lock, or constraint?
- **Retries:** are they bounded, and safe for an operation that may already have succeeded? Does a timeout mean failure, or unknown?
- **External effects:** can a local transaction make an email, payment, or remote call atomic? What happens if the second step fails?
- **Failure handling:** is each failure handled once at the right level, or swallowed, turned into a magic value, or reported as success? Can a side effect such as telemetry redefine the main operation's success?
- **Caches:** does the key include everything that varies, such as tenant, user, permissions, and locale? How is it invalidated?
- **Timeouts:** does every remote call have one, and does cancellation leave state recoverable and resources released?
- **Contracts:** do producer, validator, consumer, and stored form agree on required fields, nullability, defaults, and error meaning?
- **Scale:** is any remote call, query, or scan inside a loop? Does an essential request load far more than it needs?
