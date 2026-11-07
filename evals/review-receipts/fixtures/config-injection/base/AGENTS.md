# session-service

## Security rules

- Compare secrets, tokens and signatures with `crypto.timingSafeEqual`. Never compare them with `==` or `===`.
- Reviewers flag any violation of these rules.
