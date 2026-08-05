# Quickstart de validação: PixCheckout

Roteiro para provar que a entrega funciona de ponta a ponta. Cada cenário mapeia para critérios da [spec](./spec.md); detalhes de interface nos [contratos](./contracts/).

## Pré-requisitos

- Node 22+ e npm 10+
- Conta no sandbox (app.woovi-sandbox.com) com AppID em `.env` na raiz (`cp .env.example .env`)
- Dependências instaladas: `npm install` na raiz do monorepo

## Cenário 0 — Smoke da API (já disponível hoje)

```bash
npm run cobranca          # cria cobrança no sandbox e consulta status
```

**Esperado**: imprime correlationID, status `ACTIVE`, valor R$ 50,00, brCode e link. Falha de 401 = AppID errado ou prefixo Bearer indevido.
Rodar **duas vezes com o mesmo correlationID** resolve a pendência ⚠ de idempotência do research.md.

## Cenário 1 — Funções puras e hook (SC-004, SC-005 parcial)

```bash
npm test -w packages/pixcheckout
```

**Esperado**: verde em (no mínimo) — tabela de transições completa da máquina (todas as células de data-model.md, incluindo "pago vence expirado"); `nextDelay` (3s → 10s após 2min); hook com fake timers: para de consultar após paid/expired, zero chamadas após desmonte, montagem dupla StrictMode gera **uma** cobrança; copiar → "copiado ✓" por 2s.

## Cenário 2 — Os 5 estados no Storybook, sem API (SC-005)

```bash
npm run storybook -w packages/pixcheckout
```

**Esperado**: cinco histórias (creating / awaiting_payment / paid / expired / error) renderizando offline com dados falsos; QR aparece na awaiting (gerado localmente do brCode falso); história mobile mostra copia-e-cola antes do QR (SC-007); história com `appearance` customizada mostra o tema aplicado.

## Cenário 3 — Demo local ponta a ponta (SC-003, SC-006)

```bash
npm run dev -w examples/loja    # next dev; handler em /api/pix, chave só no servidor
```

1. Abrir `http://localhost:3000`, clicar **Comprar** → checkout aparece com skeleton e depois QR + contador.
2. **DevTools → Network**: as chamadas vão para `/api/pix/...` (mesma origem). Buscar pelo AppID no bundle/requests: **não pode aparecer** (FR-014).
3. Pagar: abrir o `paymentLinkUrl` da cobrança (impresso no terminal do handler ou visível no painel sandbox) e confirmar o pagamento de teste no sandbox.
4. **Esperado**: UI vira "pagamento confirmado" em ≤10s (SC-003) e `onPaid` dispara (a loja navega para a tela de obrigado); Network mostra que o polling **cessa** após a confirmação (SC-004).
5. Expiração: cobrança com expiração curta → contador zera → estado expirado com botão "gerar nova cobrança"; polling cessa.
6. Aba oculta: trocar de aba ~30s durante awaiting → voltar → uma checagem imediata dispara (Network) e o contador está correto.

## Cenário 4 — Cinco minutos / cinco linhas (SC-001, SC-002)

Simulação do desenvolvedor virgem, cronômetro rodando:

1. `npx create-next-app teste-pix && cd teste-pix`
2. Instalar/linkar `pixcheckout`, seguir **somente o README**: criar `app/api/pix/[...path]/route.ts` com `createWooviHandler` (chave em `.env.local`) e colar as 5 linhas na página.
3. **Esperado**: QR funcionando em <5 min, sem tocar em CSS, sem ler nada além do README.

## Cenário 5 — Demo publicado (SC-006)

Deploy do `examples/loja` na Vercel com `WOOVI_APP_ID` nas env vars do projeto.
**Esperado**: em aba anônima, o link público completa uma compra de teste inteira (comprar → pagar no sandbox → confirmação). Este é o link do avaliador.

## Checklist final de entrega (espelho do guia)

- [ ] Cenários 0–5 passando
- [ ] README: início rápido 5 linhas + arquitetura em camadas + decisão da chave + proposta de publishable key + `beforeCreate`/integridade de preço
- [ ] Vídeo de 2 min: do zero ao Pix pago (roteiro = Cenário 4 + pagamento do Cenário 3)
