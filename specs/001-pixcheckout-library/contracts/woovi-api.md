# Contrato: subconjunto da API Woovi consumido pelo core

Única dependência externa do projeto. Confirmado na doc oficial (developers.openpix.com.br / developers.woovi.com) em 2026-08-05; itens marcados ⚠ são verificados no sandbox no primeiro dia (ver pendências em research.md).

## Autenticação e base

- Header: `Authorization: {AppID}` — **sem** prefixo `Bearer`
- Sandbox: `https://api.woovi-sandbox.com` · Produção: `https://api.woovi.com`
- JSON/HTTPS; rate limit 10 req/s (nosso pior caso: 1 req/3s por checkout)

## `POST /api/v1/charge`

Request (só o que usamos):

```json
{ "correlationID": "uuid-gerado-pela-lib", "value": 5000, "comment": "Pedido #123" }
```

Response `200` (campos que o core lê — resto ignorado):

```json
{
  "charge": {
    "correlationID": "...",
    "value": 5000,
    "status": "ACTIVE",
    "brCode": "000201...",
    "qrCodeImage": "https://api.woovi.com/openpix/charge/brcode/image/...",
    "expiresIn": 900,
    "paymentLinkUrl": "https://woovi.com/pay/..."
  }
}
```

✅ **Verificado no sandbox (2026-08-05)** — as duas pendências viraram correção de código, detalhes em [research.md § R12](../research.md):

- **`expiresIn` é o TTL FIXO da cobrança, não o tempo restante.** Numa cobrança criada há 5 min ele ainda diz `86400`, enquanto `expiresDate` traz a verdade. O core usa `expiresDate`; `expiresIn` é último recurso.
- **POST repetido não é idempotente e não devolve 409.** Responde **400** com `{"error":"Já existe uma cobrança com este Correlação ID"}` (em português). O client detecta pelo prefixo `correla` e cai no GET, recuperando a mesma cobrança.

## `GET /api/v1/charge/{correlationID}`

- `correlationID` com `encodeURIComponent`
- Response `200`: mesma forma acima; `charge.status` é o campo que o polling observa
- Status esperados: `ACTIVE` (aguardando) → `COMPLETED` (pago) | `EXPIRED` (expirou)

## Mapeamento de status Woovi → core

| Woovi | Core |
|---|---|
| `COMPLETED` | `COMPLETED` |
| `EXPIRED` | `EXPIRED` |
| `ACTIVE` e qualquer outro | `ACTIVE` |

Desconhecido cai em `ACTIVE` de propósito: o pior efeito é continuar consultando, nunca declarar pago/expirado errado.
