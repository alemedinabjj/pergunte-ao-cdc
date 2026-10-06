import { LlmRequestError, LlmUnavailableError } from '../domain/errors';

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

/** POST no Ollama traduzindo falhas de rede e status HTTP para os erros do domínio. */
export async function ollamaPost(
  baseUrl: string,
  path: string,
  body: unknown,
  model: string,
  signal?: AbortSignal,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new LlmUnavailableError(
      `Não consegui falar com o Ollama em ${baseUrl}. Ele está rodando? (ollama serve)`,
      { cause: error },
    );
  }
  if (response.ok) return response;

  const text = await response.text().catch(() => '');
  if (response.status === 404 && /not found/i.test(text)) {
    throw new LlmUnavailableError(
      `Modelo "${model}" não encontrado no Ollama. Rode: ollama pull ${model}`,
    );
  }
  if (response.status >= 500) {
    throw new LlmUnavailableError(`Ollama respondeu ${response.status}: ${text.slice(0, 200)}`);
  }
  throw new LlmRequestError(`Ollama respondeu ${response.status}: ${text.slice(0, 200)}`);
}
