# ADR 0001: RAG "SQL-first", sem framework de IA

- **Status:** aceito
- **Data:** 2026-10-05

## Contexto

O projeto existe para mostrar como um RAG funciona por dentro: como o texto vira trecho, como a
busca escolhe o que vai para o modelo e como a resposta cita a fonte. Frameworks como LangChain e
LlamaIndex resolvem isso em poucas linhas, mas escondem justamente essas decisões atrás de
abstrações genéricas.

## Decisão

Implementar cada etapa no próprio código, com portas e adaptadores no NestJS:

- `Embedder` e `LlmClient` são interfaces; OpenAI, Ollama e Claude são adaptadores.
- A busca híbrida é **uma query SQL** escrita com o `sql` do Drizzle (vetor + full-text + RRF).
- Prompts ficam versionados como código (`apps/api/src/modules/chat/prompts`).

## Consequências

- Cada parte tem teste próprio, com fakes determinísticos no lugar dos provedores.
- Trocar de provedor é escrever um adaptador; o resto do sistema não muda.
- Mais código para manter do que com um framework, e recursos prontos (rerankers, loaders de
  PDF etc.) precisam ser escritos quando forem necessários.

## Alternativas consideradas

- **LangChain.js / LlamaIndex.TS:** mais rápido de começar, mas o repositório viraria código de
  cola em volta de chamadas opacas.
- **Função PL/pgSQL `hybrid_search()`:** performática, porém mais difícil de testar e versionar,
  e coloca regra de negócio dentro do banco.
