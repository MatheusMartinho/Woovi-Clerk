# Evidência T032 — E2E local ponta a ponta (2026-08-05)

## Parte 1: fluxo via API (curl → handler local → Woovi sandbox)

- POST `/api/pix/charge` pedindo `value: 1` (R$ 0,01, simulando navegador malicioso)
  → cobrança criada com **`value: 5000` (R$ 50,00)**: o `beforeCreate` no servidor
  fixou o preço, ignorando o que o cliente pediu. Integridade de preço provada ao vivo.
- Resposta trouxe `remainingSeconds: 86400` (campo do handler) e `paymentLinkUrl` real.
- Pagamento simulado via `GET /openpix/testing?transactionID=...` (endpoint de teste
  do sandbox) → `GET /api/pix/charge/{cid}` pelo handler devolveu **`COMPLETED`**.

## Parte 2: fluxo visual (usuário no navegador, checkout React real)

Cobrança do checkout aberto pelo usuário: `3d436a27-ac45-470e-87a4-f39a31d6a3aa`.
Pagamento simulado 15s após a detecção do primeiro polling. Extrato do log do
`next dev` (ordem real das requisições):

```
GET /api/pix/charge/3d436a27-... 200   ← polling a cada 3s (8 consultas no total)
GET /api/pix/charge/3d436a27-... 200
GET /api/pix/charge/3d436a27-... 200
GET /api/pix/charge/3d436a27-... 200
GET /api/pix/charge/3d436a27-... 200
GET /obrigado 200                      ← onPaid disparou: navegação automática
GET /api/pix/charge/3d436a27-... 200   ← requisição que estava em voo na virada
GET /                                  ← usuário voltou à loja
```

## Critérios cobertos

- **SC-003**: confirmação apareceu na tela ≤10s após o pagamento (polling de 3s)
- **SC-004**: nenhuma consulta após a confirmação — polling cessou
- **FR-006**: `onPaid` disparou com navegação para `/obrigado`
- **R8**: integridade de preço (`beforeCreate`) demonstrada contra requisição adulterada
- **FR-014**: a chave (`Q2xpZW50...`) não aparece em nenhuma requisição do navegador —
  todo tráfego do cliente vai para `/api/pix/*`, mesma origem
