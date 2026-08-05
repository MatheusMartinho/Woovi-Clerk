# PixCheckout

**Checkout Pix completo em cinco linhas de React.** O que o Clerk fez pelo login, feito para o Pix da [Woovi](https://woovi.com).

```tsx
<WooviProvider endpoint="/api/pix">
  <PixCheckout amount={5000} onPaid={(charge) => router.push('/obrigado')} />
</WooviProvider>
```

O que essas linhas entregam sem você escrever nada: criação da cobrança, QR code, botão copia-e-cola com feedback, contador de expiração, confirmação de pagamento em tempo quase real, tela de expirado com nova cobrança, estados de erro com retry — e a chave da API **nunca** aparece no navegador.

🛒 **Demo ao vivo**: _[link da Vercel — publicar com `vercel deploy`]_ · 🎬 **Vídeo de 2 min**: _[link]_

---

## Início rápido (5 minutos, de verdade)

Num app Next.js (App Router):

**1.** Instale a biblioteca e crie o backend do checkout — um arquivo:

```ts
// app/api/pix/[...path]/route.ts
import { createWooviHandler } from 'pixcheckout/server';

const handler = createWooviHandler({ appId: process.env.WOOVI_APP_ID! });
export { handler as GET, handler as POST };
```

**2.** Coloque a chave no ambiente do servidor (pegue a sua em [app.woovi-sandbox.com](https://app.woovi-sandbox.com) → API/Plugins):

```bash
# .env.local
WOOVI_APP_ID=seu_appid_do_sandbox
```

**3.** Cole as cinco linhas na sua página:

```tsx
'use client';
import { PixCheckout, WooviProvider } from 'pixcheckout';

<WooviProvider endpoint="/api/pix">
  <PixCheckout amount={5000} onPaid={(charge) => console.log('pago!', charge)} />
</WooviProvider>
```

Pronto. QR na tela, pagamento confirmando sozinho.

---

## A decisão de arquitetura mais importante: a chave nunca toca o navegador

Chave secreta em código de frontend é chave pública — qualquer pessoa abre o DevTools e leva. Por isso o PixCheckout **não tem modo inseguro**: não existe prop `apiKey` no provider, de propósito. Todo tráfego passa pelo *seu* backend, e para isso não custar seu tempo, a biblioteca entrega esse backend pronto (`createWooviHandler`, padrão Web Request/Response — funciona em Next.js, funções Vercel, Hono, Bun, Node puro).

É o mesmo desenho do Clerk e do Stripe: o SDK de navegador nunca segura segredo.

### Esconder a chave não basta: integridade de preço

Um proxy ingênuo repassa o que o navegador mandar — inclusive "cobre R$ 0,01" num produto de R$ 50. O hook `beforeCreate` roda no seu servidor e tem a palavra final:

```ts
const handler = createWooviHandler({
  appId: process.env.WOOVI_APP_ID!,
  // o PREÇO é decidido aqui, não no navegador:
  beforeCreate: (payload) => ({ ...payload, value: 5000 }),
});
```

### Proposta para a Woovi: chave publicável

O Stripe resolve isso com dois tipos de chave: a *publishable* (pode ir ao navegador; só faz operações inofensivas) e a *secret* (fica no servidor). Se a Woovi emitisse uma chave publicável — escopo: criar cobrança e ler status, nada de saque/estorno/listagem —, o handler se tornaria opcional e o setup cairia para isto:

```tsx
// API hipotética, se pk_ existisse:
<WooviProvider publishableKey="pk_woovi_...">
  <PixCheckout amount={5000} onPaid={...} />
</WooviProvider>
```

Até lá, o handler pronto mantém o setup em cinco minutos sem abrir mão da segurança. (Mesmo com pk, o `beforeCreate` continuaria valendo para preço — são problemas diferentes.)

---

## Arquitetura em camadas

**Core sem framework, hooks headless, componentes estilizados por cima.**

```
pixcheckout/core    TypeScript puro, zero React. Cliente da API, máquina de
                    estados (função pura), agenda de polling. Roda em Node
                    sem build — o script scripts/criar-cobranca.mjs prova.

pixcheckout         usePixCharge()  → camada headless: estado, dados e ações,
                                      nenhum visual. Para quem tem design próprio.
                    <PixCheckout /> → o caminho de 90%: checkout completo.
                    <WooviProvider> → endpoint do seu backend + tema.
                    (+ <PixQRCode/>, <PixCopyButton/>, <PixStatus/> para compor)

pixcheckout/server  createWooviHandler() → seu backend pronto, chave em env var.
```

### O coração: a máquina de estados

Um checkout Pix não é uma tela, é uma sequência de estados — modelada como função pura no core, com todas as transições testadas:

```
creating ──► awaiting_payment ──► paid ✓
                   │
                   ├──► expired ──► (gerar nova cobrança) ──► creating
qualquer ──► error ──► (tentar de novo) ──► creating
```

Regra de ouro: **pago vence expirado**. Quando o contador zera, uma checagem final roda antes de declarar expirado — dinheiro recebido nunca fica escondido.

### Como o componente sabe que pagou (sem webhook no navegador)

Webhook é servidor→servidor; um componente React não recebe webhook. Então o hook consulta o status:

- **a cada 3s nos primeiros 2 minutos** (a maioria dos Pix é paga logo), 10s depois;
- com `setTimeout` **encadeado**, nunca `setInterval` — a próxima consulta só é agendada quando a anterior responde, então rede lenta jamais empilha requisições;
- **pausa com a aba oculta** e checa imediatamente na volta;
- **para** ao pagar/expirar e **limpa tudo no desmonte** (timers, listeners e a requisição em voo via AbortController);
- tolera 2 falhas de rede seguidas; na 3ª vira estado de erro com retry.

E o React 18+ monta componentes duas vezes em desenvolvimento: o `correlationID` é estável por intenção de compra, então remontagem **não** cria cobrança duplicada.

## Detalhes de produto

- **No celular, QR code é inútil** — ninguém aponta a câmera para a própria tela. Em recipiente estreito o copia-e-cola assume o protagonismo (via container query: o widget responde ao espaço que recebeu, não à janela).
- Botão de copiar vira **"Copiado ✓" por 2 segundos**; se o clipboard for negado, o código aparece selecionável.
- **Contador visível**; ao expirar a tela não se esvazia — surge o botão de nova cobrança.
- Carregamento com **skeleton** no formato do conteúdo final.
- Tema via prop `appearance` (cor, raio, fonte) → CSS variables; sem importar CSS, sem guerra de especificidade:

```tsx
<WooviProvider endpoint="/api/pix" appearance={{ colorPrimary: '#7c3aed', borderRadius: '4px' }}>
```

## Rodando este repositório

```bash
npm install

npm test                 # 50 testes: máquina, polling, hook, handler, componentes
npm run storybook        # uma história por estado, offline, sem API
npm run cobranca         # smoke test da API no sandbox (precisa de .env com WOOVI_APP_ID)

# demo (loja fictícia):
cp examples/loja/.env.local.example examples/loja/.env.local  # cole seu AppID
npm run dev              # http://localhost:3000
```

Especificação, plano e decisões técnicas com alternativas rejeitadas: [`specs/001-pixcheckout-library/`](specs/001-pixcheckout-library/).

## Escopo desta entrega

Um componente redondo em vez de seis capengas: sem Vue/Svelte, sem boleto/cartão/split/recorrência, sem publicação no npm. As fronteiras de camada existem exatamente para que cada uma dessas extensões seja adição, não reescrita.
