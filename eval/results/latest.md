# Avaliação do retrieval

- Data: 2026-10-06
- Modelo de embeddings: `bge-m3`
- Perguntas: 28 (24 dentro do escopo, 4 fora)

## Recall e MRR (perguntas dentro do escopo)

| Modo | Recall@1 | Recall@3 | Recall@6 | MRR |
|---|---|---|---|---|
| semantic | 62.5% | 75.0% | 79.2% | 0.688 |
| keyword | 33.3% | 58.3% | 75.0% | 0.489 |
| hybrid | 75.0% | 83.3% | 91.7% | 0.813 |

## Calibração do limiar de "não sei"

Recusa quando não há artigo citado e a melhor similaridade fica abaixo do limiar. Orçamento de recusas indevidas: 5.0% das perguntas válidas.

| Limiar | Recusas corretas | Recusas indevidas |
|---|---|---|
| 0.30 | 0/4 | 0/24 |
| 0.35 | 0/4 | 0/24 |
| 0.40 | 0/4 | 0/24 |
| 0.45 | 0/4 | 0/24 |
| 0.50 | 2/4 | 0/24 |
| 0.55 | 4/4 | 3/24 |
| 0.60 | 4/4 | 8/24 |
| 0.65 | 4/4 | 15/24 |
| 0.70 | 4/4 | 19/24 |
| 0.75 | 4/4 | 20/24 |
| 0.80 | 4/4 | 21/24 |

**Limiar recomendado:** 0.50

## Perguntas que o modo híbrido errou (top 6)

- "O banco só libera o empréstimo se eu fizer um seguro junto. É permitido?" → esperado cdc art. 39; veio cdc art. 101, cdc art. 54-G, cdc art. 54-D
- "A propaganda mostrava um preço e na loja cobraram outro. O que fazer?" → esperado cdc art. 30, cdc art. 35; veio cdc art. 37, cdc art. 41, cdc art. 39
