# ADR 0002: Busca híbrida com Reciprocal Rank Fusion

- **Status:** aceito
- **Data:** 2026-10-05

## Contexto

Busca só por vetor erra perguntas com termos exatos ("o que diz o art. 54-A?") e às vezes prefere
um artigo parecido no assunto em vez do artigo certo. Busca só por palavra-chave erra quando a
pessoa usa outras palavras ("me arrependi da compra" contra "desistir do contrato").

## Decisão

Uma única query no Postgres combina três listas de candidatos e funde os rankings com RRF
(`score = Σ 1 / (60 + posição)`):

1. **Semântica:** 30 vizinhos mais próximos por distância de cosseno (pgvector, índice HNSW com
   `hnsw.iterative_scan = relaxed_order` para o filtro por lei não devolver menos linhas).
2. **Palavra-chave:** full-text em português sem acento (`pt_unaccent`), com os termos ligados
   por **OR**. Com AND, uma pergunta em linguagem natural quase nunca casa com nenhum artigo.
3. **Artigo exato:** quando a pergunta cita "art. N", o artigo entra direto.

A guarda de "não sei" usa só a similaridade semântica e o artigo exato: com OR, quase sempre
algum termo casa ("pena" aparece nos crimes do CDC), então o match de palavra-chave não serve
como sinal de relevância.

## Consequências

- No conjunto de avaliação, a busca híbrida teve recall@6 de 91,7% contra 79,2% da busca só
  vetorial (detalhes em `eval/results/latest.md`).
- O limiar de "não sei" precisa ser recalibrado quando o modelo de embedding muda, porque a
  escala de similaridade muda junto.

## Alternativas consideradas

- **Reranker (cross-encoder):** tende a melhorar a ordem final, mas adiciona um modelo e uma
  chamada a mais. Fica como próximo passo, decidido pelo eval.
- **Combinação linear de scores:** exige normalizar escalas diferentes (cosseno contra
  `ts_rank_cd`); o RRF usa só as posições e dispensa calibração.
