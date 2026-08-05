# Contrato: `createWooviHandler` (`pixcheckout/server`) + HTTP frontend↔handler

## Fábrica

```ts
function createWooviHandler(config: {
  appId: string;                    // SEMPRE de variável de ambiente — nunca literal
  baseUrl?: string;                 // default: https://api.woovi-sandbox.com (prod: https://api.woovi.com)
  beforeCreate?: (payload: CreateChargePayload, req: Request) =>
    CreateChargePayload | Promise<CreateChargePayload>;  // validar/FIXAR valor no servidor (R8)
}): (req: Request) => Promise<Response>;
```

Padrão **Web Request/Response** — monta em qualquer runtime moderno:

```ts
// examples/loja/app/api/pix/[...path]/route.ts  (Next.js App Router)
import { createWooviHandler } from 'pixcheckout/server';

const handler = createWooviHandler({
  appId: process.env.WOOVI_APP_ID!,
  beforeCreate: (payload) => ({ ...payload, value: 5000 }), // preço decidido AQUI, não no navegador
});

export { handler as GET, handler as POST };
```

## Endpoints expostos (relativos ao `endpoint` do provider — só estes dois)

### `POST {endpoint}/charge`

- Body: `{ correlationID: string, value: number, comment?: string }`
- Fluxo: valida forma → `beforeCreate` (se fornecido, o retorno **substitui** o payload) → repassa à Woovi com o header `Authorization: {appId}`
- `200`: `{ charge: Charge }` (normalizada — ver data-model.md)
- `409`: correlationID já usado e irrecuperável (o client faz fallback GET antes de desistir — R9)

### `GET {endpoint}/charge/{correlationID}`

- `200`: `{ charge: Charge }` · `404`: `{ error }` se não existe

### Erros (formato único)

`{ error: { code: 'validation' | 'woovi_api' | 'not_found', message: string } }` com status HTTP correspondente. A mensagem **nunca** ecoa o appId nem o corpo cru de erro da Woovi (evita vazar detalhe de credencial em log de navegador).

## Regras de segurança

1. `appId` só via env var; o handler lança na inicialização se ausente ou vazio.
2. Nenhum outro caminho/método é atendido → `404` (superfície mínima).
3. `beforeCreate` é o ponto de integridade de preço; o README mostra o exemplo acima e explica o ataque que ele previne.
4. Same-origin por padrão (sem headers CORS); README documenta como liberar outra origem conscientemente.

## Escopos da chave (verificado no painel em 2026-08-05)

A chave criada para este projeto marca **apenas** `CHARGE_POST` e `CHARGE_GET` — as duas únicas operações que o core executa. Ficam de fora: `CHARGE_GET_LIST` (exporia o faturamento da loja), `CHARGE_DELETE`/`CHARGE_PATCH` (destrutivos; expiração gera cobrança nova em vez de editar), `CHARGE_REFUND_GET_LIST`/`CHARGE_REFUND_POST` (dinheiro saindo) e `CHARGE_IMAGE_GET`/`CHARGE_BRCODE_IMAGE_GET` (desnecessários: o QR é gerado no cliente a partir do `brCode` — R6).

## Proposta "publishable key" (compromisso do FR-014, vai no README)

Seção do README endereçada à Woovi: o mecanismo de escopos acima **já define** o que seria uma operação inofensiva. Uma chave restrita a `CHARGE_POST` + `CHARGE_GET` e limitada por domínio de origem seria segura no navegador — o pior abuso possível é criar cobranças para a própria loja. Com ela o handler viraria opcional e o provider aceitaria `publishableKey="pk_..."`; o README mostra a API atual e a hipotética lado a lado. Referência: modelo publishable/secret do Stripe.
