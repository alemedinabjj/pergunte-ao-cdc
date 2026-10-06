/** O provedor não está acessível: Ollama desligado, 5xx ou modelo não baixado. */
export class LlmUnavailableError extends Error {
  override readonly name = 'LlmUnavailableError';
}

/** O provedor respondeu, mas recusou a requisição (4xx que não é "modelo não encontrado"). */
export class LlmRequestError extends Error {
  override readonly name = 'LlmRequestError';
}
