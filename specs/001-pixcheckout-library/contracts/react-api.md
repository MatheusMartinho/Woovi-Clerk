# Contrato: superfície pública React (`pixcheckout`)

Tudo que o integrador pode importar de `pixcheckout`. Qualquer coisa fora daqui é interna e pode mudar.

## As cinco linhas (o contrato-mestre)

```tsx
<WooviProvider endpoint="/api/pix">
  <PixCheckout amount={5000} onPaid={(charge) => router.push('/obrigado')} />
</WooviProvider>
```

## `<WooviProvider />`

| Prop | Tipo | Obrigatória | Descrição |
|---|---|---|---|
| `endpoint` | `string` | sim | URL do backend do lojista onde o `createWooviHandler` está montado (ex.: `/api/pix`). **Não existe prop de apiKey** — modo inseguro não é suportado (FR-014) |
| `appearance` | `Appearance` | não | `{ colorPrimary?, borderRadius?, fontFamily? }` — vira CSS variables |
| `children` | `ReactNode` | sim | |

Comportamento: injeta a stylesheet da biblioteca uma única vez; fornece contexto para hook e componentes. Componente/hook usado fora do provider → erro claro em dev: `"<PixCheckout /> precisa estar dentro de <WooviProvider>"`.

## `<PixCheckout />` (camada 3 — o caminho de 90%)

| Prop | Tipo | Obrigatória | Descrição |
|---|---|---|---|
| `amount` | `number` | sim | Centavos, inteiro > 0. `5000` = R$ 50,00 |
| `onChargeCreated` | `(charge: Charge) => void` | não | **Uma vez por intenção**, quando a cobrança fica pronta — para a loja amarrar o `correlationID` ao pedido (conciliação) |
| `onPaid` | `(charge: Charge) => void` | não | Disparado **uma única vez** na confirmação |
| `onExpired` | `(charge: Charge) => void` | não | Disparado quando expira |
| `comment` | `string` | não | Descrição repassada à cobrança |
| `className` | `string` | não | Classe extra no elemento raiz |

Comportamento por estado (FR-003, FR-007–011, FR-016):

- `creating`: **skeleton** no formato do conteúdo final (nunca spinner solto)
- `awaiting_payment`: QR (SVG local) + botão copia-e-cola + contador `mm:ss` + valor formatado. **Em viewport < 640px o botão copia-e-cola vem antes do QR** (FR-009)
- `paid`: confirmação de sucesso + valor
- `expired`: aviso + botão "gerar nova cobrança" (a tela nunca se esvazia)
- `error`: mensagem amigável + botão "tentar de novo"

## `usePixCharge()` (camada 2 — headless)

```ts
function usePixCharge(options: {
  amount: number;            // centavos
  comment?: string;
  onPaid?: (charge: Charge) => void;
  onExpired?: (charge: Charge) => void;
}): {
  state: CheckoutState;      // união discriminada — ver data-model.md
  charge: Charge | null;     // atalho para state.charge quando existir
  remainingMs: number;       // derivado de expiresAt; 0 fora de awaiting_payment
  copyToClipboard: () => Promise<boolean>;  // false se clipboard negado (fallback: código visível)
  retry: () => void;         // válido em error
  newCharge: () => void;     // válido em expired
};
```

Garantias: cria a cobrança ao montar (FR-002); nunca cria duplicada em montagem dupla (FR-020); interrompe todo polling/timers no desmonte (FR-005); não renderiza nada.

## Subcomponentes (usados por `<PixCheckout />`, exportados para composição)

- `<PixQRCode brCode={string} size?={number} />` — SVG gerado localmente
- `<PixCopyButton brCode={string} />` — copia + estado "copiado ✓" por 2s (FR-008)
- `<PixStatus />` — contador/estado atual (consome o contexto do checkout)

## Exports de tipos

`Charge`, `CheckoutState`, `Appearance`, `PixError` (e subclasses `PixApiError`, `PixValidationError`).

## Subpath `pixcheckout/core`

`createCoreClient(baseUrl, options?)` → `{ createCharge({correlationID, value, comment}), getCharge(correlationID) }`, mais `transition()`, `nextDelay()` e os tipos. Zero imports de React — utilizável em Node puro (é o que `scripts/criar-cobranca.mjs` passará a usar).
