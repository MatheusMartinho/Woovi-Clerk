# Data Model: PixCheckout (Fase 1)

## Entidades

### Charge (cobrança)

Representação interna (camada core) de uma cobrança Pix. Normalizada a partir da resposta da Woovi ([contrato](./contracts/woovi-api.md)) — os componentes nunca veem o payload cru da API.

| Campo | Tipo | Origem (Woovi) | Regras |
|---|---|---|---|
| `correlationID` | `string` | ecoado | Gerado pela biblioteca (UUID), **um por intenção de compra** (R9); identidade da cobrança para consulta |
| `value` | `number` | `value` | **Centavos, inteiro positivo** (5000 = R$ 50,00); nunca decimal |
| `status` | `'ACTIVE' \| 'COMPLETED' \| 'EXPIRED'` | `status` | Demais status da Woovi mapeados: concluído → `COMPLETED`, expirado → `EXPIRED`, resto → `ACTIVE` |
| `brCode` | `string` | `brCode` | Código copia-e-cola; fonte do QR gerado localmente (R6) |
| `qrCodeImage` | `string \| undefined` | `qrCodeImage` | URL da imagem da Woovi; guardada apenas como fallback, não usada na UI |
| `expiresAt` | `number` (epoch ms) | `expiresIn`/`expiresDate` | Normalizado no client para instante absoluto — o contador deriva daqui, nunca de "segundos restantes" decrementados |
| `paymentLinkUrl` | `string \| undefined` | `paymentLinkUrl` | Usado no quickstart/vídeo para simular pagamento |

Validações no core client: `value > 0` e inteiro (lança `PixValidationError` antes de qualquer rede); resposta sem `brCode` ou sem expiração → `PixApiError`.

### CheckoutState (estado do checkout)

União discriminada — **impossível representar estado ambíguo** (FR-003):

```
{ status: 'creating' }
{ status: 'awaiting_payment', charge: Charge }
{ status: 'paid',             charge: Charge }
{ status: 'expired',          charge: Charge }   // guarda a cobrança para exibir valor/contexto
{ status: 'error',  reason: 'create_failed' | 'polling_lost', error: PixError, charge?: Charge }
```

O tempo restante do contador **não** vive no estado — é derivado (`charge.expiresAt - agora`) a cada render/tick, eliminando bugs de dessincronização.

### CheckoutEvent (eventos da máquina)

| Evento | Emitido por |
|---|---|
| `CHARGE_READY { charge }` | criação concluída (ou recuperada via fallback GET — R9) |
| `CREATE_FAILED { error }` | falha na criação |
| `STATUS_PAID { charge }` | polling retornou `COMPLETED` |
| `STATUS_EXPIRED` | polling retornou `EXPIRED` **ou** contador zerou e a checagem final não veio paga |
| `POLLING_LOST { error }` | 3ª falha consecutiva de rede no polling (R5) |
| `RETRY` | usuário clicou "tentar de novo" no estado de erro |
| `NEW_CHARGE` | usuário clicou "gerar nova cobrança" no estado expirado |

### Máquina de estados — tabela de transições

`transition(state, event)` é função pura no core (R4). Célula vazia = evento ignorado (estado inalterado — nunca exceção).

| estado \ evento | CHARGE_READY | CREATE_FAILED | STATUS_PAID | STATUS_EXPIRED | POLLING_LOST | RETRY | NEW_CHARGE |
|---|---|---|---|---|---|---|---|
| **creating** | → awaiting_payment | → error(create_failed) | | | | | |
| **awaiting_payment** | | | → paid | → expired | → error(polling_lost) | | |
| **expired** | | | → **paid** ¹ | | | | → creating ² |
| **error** | | | → paid ³ | | | → creating ² | |
| **paid** | | | | | | | |

¹ **Pago vence expirado** (edge case da spec): ao contador zerar, o hook dispara uma checagem final antes de aceitar `STATUS_EXPIRED`; se uma resposta em voo chegar paga, o evento é aceito mesmo em `expired`.
² `RETRY`/`NEW_CHARGE` → `creating` com **novo** `correlationID` (nova intenção de compra).
³ Se a rede voltar e revelar pagamento, dinheiro recebido nunca fica escondido atrás de uma tela de erro.

`paid` é terminal: nenhum evento sai dele.

### Regras de efeitos por estado (vivem no hook, fora do reducer)

| Estado | Efeitos ativos |
|---|---|
| `creating` | POST de criação (com AbortController); nada de timers |
| `awaiting_payment` | polling via `setTimeout` encadeado (R5) + tick do contador + listener `visibilitychange` |
| `paid` / `expired` / `error` | **nenhum** — entrada nesses estados cancela timers e requisições em voo |
| (desmonte em qualquer estado) | aborta requisição em voo, limpa todos os timers, remove listeners (FR-005) |

### Appearance (tema)

```
{ colorPrimary?: string; borderRadius?: string; fontFamily?: string }
```

Aplicado como CSS variables `--pixck-color-primary`, `--pixck-radius`, `--pixck-font` no elemento raiz (R7). Defaults embutidos garantem visual apresentável com objeto vazio (SC-002).

### Texts (pt-BR)

Objeto único em `i18n/texts.ts` (FR-022) com todas as strings do comprador: instruções, "copiar código", "copiado ✓", "pagamento confirmado", "cobrança expirada", "gerar nova cobrança", "algo deu errado", "tentar de novo", rótulos do contador.

## Relacionamentos

```
WooviProvider (endpoint + appearance)
   └── usePixCharge(value, opts)
         ├── usa CoreClient(endpoint)        → fala com o handler, nunca com a Woovi direto
         ├── usa transition(state, event)    → única fonte de mudança de estado
         └── expõe { state, actions }        → consumido por <PixCheckout /> ou UI própria (P2)

createWooviHandler (servidor)
   └── usa CoreClient(api.woovi-sandbox.com, appId)  → mesmo client core, agora com a chave
```

O mesmo `CoreClient` serve navegador (apontando pro handler, sem chave) e servidor (apontando pra Woovi, com chave) — é a prova concreta de que a camada 1 "funciona fora do React, inclusive em Node".
