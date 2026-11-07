# LLM features and AI-written code

## Code that calls a model

- **Prompt injection:** can user content, fetched pages, or documents steer the model into a tool call or data access? Keep untrusted text separated, and enforce permissions outside the model.
- **Tool permissions:** what is the worst thing the model can do with its tools? Are destructive actions confirmed or scoped?
- **Output trust:** is model output treated as untrusted before reaching a query, shell, HTML, or file path? Is structured output validated?
- **Cost limits:** are tokens, loops, retries, and fan-out bounded? Can one user run up the bill?
- **Failure:** what happens on a timeout, refusal, truncated output, or rate limit?
- **Data:** is personal data or a secret sent to a provider or written to logs unintentionally?

## AI-written code

These mistakes are common and often pass a quick read. Check them against the actual code and installed versions, since an unfamiliar API may be real and a familiar-looking one may not exist.

- **Invented APIs:** does each function, method, option, and package exist in the installed version? Pay most attention on paths the tests don't reach.
- **Tests that prove little:** do they assert only what the code happens to do, mock out the risky part, or skip the failure path?
- **Weakened checks:** were assertions, types, lint rules, or validation loosened so that the result passes?
- **Parallel code:** was a new helper or pipeline built when the project already had one?
- **Unneeded machinery:** layers, options, and fallbacks with no current need.
- **Hidden failure:** broad catches, default values on error, or fallbacks that hide a broken dependency.
- **Comments that lie:** does a comment claim something the code doesn't do, such as "constant-time" or "thread-safe"?
- **Leftovers:** dead code, debug output, placeholder values, or `TODO` stubs left on a real path.
