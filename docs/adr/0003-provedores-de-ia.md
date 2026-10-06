# ADR 0003: OpenAI como padrão, Ollama e Claude como alternativas

- **Status:** aceito (revisa a decisão inicial de usar Ollama por padrão)
- **Data:** 2026-10-06

## Contexto

A primeira versão rodava tudo localmente com Ollama (`bge-m3` para embeddings e `qwen2.5:3b`
para as respostas), para quem clonasse o repositório não precisar de chave nem pagar nada. Na
prática, o modelo de chat rodando junto com Docker e Node travou o MacBook de 8 GB usado no
desenvolvimento.

## Decisão

- **Padrão:** OpenAI, com `text-embedding-3-small` reduzido para 1024 dimensões (o parâmetro
  `dimensions` mantém o mesmo schema do banco) e `gpt-6-luna` pela Responses API.
- **Alternativas:** Ollama (100% local, recomendado a partir de 16 GB de RAM) e Claude para as
  respostas, escolhidos por `EMBEDDING_PROVIDER` e `LLM_PROVIDER`.
- Os modelos de raciocínio atuais recusam `temperature`; os adaptadores da OpenAI e da Anthropic
  não enviam esse parâmetro e controlam o tamanho da resposta pelo prompt.

## Consequências

- Rodar o projeto passa a exigir uma chave da OpenAI. A ingestão das três leis custa menos de um
  centavo e cada pergunta, frações de centavo.
- O avaliador continua podendo rodar tudo local, sem chave, em uma máquina com mais memória.
- Trocar o modelo de embedding exige reindexar (`pnpm ingest` detecta a troca e refaz os vetores)
  e rodar o eval de novo para recalibrar o limiar de "não sei".

## Alternativas consideradas

- **Embeddings locais leves com Transformers.js + Claude:** gratuito nos embeddings, porém com
  mudança de dimensão (384) e duas peças diferentes para configurar.
- **Voyage + Claude:** boa qualidade, mas duas chaves de API para quem clonar.
