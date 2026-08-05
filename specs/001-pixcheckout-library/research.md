# Research: PixCheckout — decisões técnicas (Fase 0)

Cada decisão abaixo é uma resposta de entrevista em potencial. O formato é sempre: o que foi decidido, por quê, e o que foi rejeitado.

## R1. Estrutura do repositório

- **Decision**: Monorepo com **npm workspaces** (`packages/*` + `examples/*`), com a biblioteca em um único pacote `pixcheckout` exposto por três subpaths: `pixcheckout` (React), `pixcheckout/core`, `pixcheckout/server`.
- **Rationale**: As camadas do guia ("core sem framework, hooks headless, componentes por cima") são fronteiras de **import**, não de empacotamento. Um pacote com subpaths dá a mesma história arquitetural com um terço da burocracia — um `package.json`, um `tsconfig`, um runner de testes. npm workspaces é nativo (npm 10 já instalado), sem pnpm/turborepo para explicar.
- **Alternatives considered**: (a) três pacotes (`@pixcheckout/core`, `/react`, `/server`) — correto para publicação no npm, mas publicação está fora do escopo e triplicaria o setup; (b) tudo num único src sem workspace — impede o demo de consumir a lib como dependência de verdade, enfraquecendo a história "é uma biblioteca".

## R2. Build da biblioteca

- **Decision**: **Sem build de distribuição.** O demo e o Storybook consomem o código-fonte TypeScript direto do workspace (`transpilePackages` no Next). Checagem por `tsc --noEmit` no CI manual.
- **Rationale**: O checklist do desafio exclui explicitamente "publicar no npm com versionamento e pipeline". Um bundle (tsup/rollup) só serviria a essa publicação; removê-lo elimina uma classe inteira de problemas (dual ESM/CJS, source maps, watch). Se um dia publicar, adicionar `tsup` é uma tarde.
- **Alternatives considered**: tsup (ótimo, mas resolve um problema que não temos); Vite library mode (idem, e complica o consumo de tipos).

## R3. Framework do app de exemplo

- **Decision**: **Next.js 16 (App Router)** em `examples/loja`, deploy na Vercel.
- **Rationale**: O handler precisa de um servidor — Next dá frontend + rota de API num único `next dev`, sem CLI extra, e o deploy na Vercel é zero-config. É também o ambiente onde o público-alvo integraria (o quickstart do Clerk é Next), então o demo duplica como documentação viva do caminho recomendado.
- **Alternatives considered**: Vite SPA + diretório `api/` de funções Vercel — frontend mais simples, mas o dev local passa a exigir `vercel dev` e a história do handler fica menos padrão; Express próprio — servidor para manter, nada a ganhar.

## R4. Máquina de estados

- **Decision**: **Reducer puro no core**: `transition(state: CheckoutState, event: CheckoutEvent): CheckoutState`, sem biblioteca. O hook usa `useReducer` com essa função e mantém efeitos (fetch, timers) fora dela.
- **Rationale**: A transição é a parte com mais chance de bug e a mais perguntável — como função pura, ela é testável em milissegundos sem React e sem rede ("dado estado X e evento Y, o resultado é Z"). Frase de entrevista: *"a máquina de estados é uma função pura no core; o React só despacha eventos e executa efeitos"*.
- **Alternatives considered**: XState — máquina formal de verdade, mas é dependência de runtime + curva de aprendizado para defender; `useState` ad hoc espalhado — exatamente o "estado ambíguo" que o guia manda evitar.

## R5. Política de polling (decisão adiada do /clarify, resolvida aqui)

- **Decision**:
  - Intervalo: **3s nos primeiros 2 minutos, 10s depois** (a maioria dos Pix é paga no primeiro minuto; depois disso, urgência cai).
  - Implementação: **`setTimeout` encadeado, nunca `setInterval`** — o próximo agendamento só acontece quando a resposta anterior chega, impossibilitando requisições sobrepostas em rede lenta.
  - Aba oculta: **pausa** o polling (`visibilitychange`); ao voltar, **checa imediatamente**.
  - Parada: pagamento confirmado, expiração ou desmonte do componente — o desmonte cancela timer + requisição em voo (`AbortController`).
  - Falha de rede durante polling: **não** derruba para o estado de erro na primeira falha; após **3 falhas consecutivas**, estado `error` com retry. Falha na **criação** da cobrança vai direto para `error`.
  - A agenda vive numa função pura `nextDelay(elapsedMs)` no core — testável sem timers.
- **Rationale**: Cobre exatamente as perguntas anunciadas no guia (intervalo, aumento, quando parar, troca de aba, cleanup). Rate limit da Woovi é 10 req/s; 1 req/3s por checkout é ordens de magnitude abaixo.
- **Alternatives considered**: intervalo fixo único (desperdiça requisições em cobranças longas); backoff exponencial (piora o pior caso de detecção do pagamento sem necessidade — o teto de 10s já limita o custo); WebSocket/SSE (a Woovi não oferece para este caso; webhook → navegador não existe).

## R6. Renderização do QR code

- **Decision**: Gerar o QR **localmente a partir do `brCode`** com **`uqr`** (~4KB, saída SVG, zero dependências próprias), em vez de usar a URL `qrCodeImage` da Woovi.
- **Rationale**: Sem requisição extra nem flash de carregamento; funciona no Storybook offline com dados falsos (requisito SC-005); SVG escala perfeito em qualquer densidade de tela. Única dependência de runtime da biblioteca — justificada por escrito, como manda o princípio 4.
- **Alternatives considered**: `<img src={qrCodeImage}>` — zero deps, mas depende do CDN da Woovi, pisca ao carregar e não renderiza em histórias offline; pacote `qrcode` — canvas, maior e assíncrono.

## R7. Tema e estilo

- **Decision**: **CSS variables + stylesheet única injetada pelo provider** (uma tag `<style>`, injetada uma vez). A prop `appearance` (cor principal, raio de borda, fonte) vira variáveis `--pixck-*` no elemento raiz do checkout. Classes prefixadas `pixck-`.
- **Rationale**: Mantém a promessa das cinco linhas — nenhum `import 'pixcheckout/styles.css'` para esquecer. Custom properties são o mecanismo nativo de tema: o integrador muda 3 valores sem guerra de especificidade, cumprindo FR-015 literalmente ("sem sobrescrever CSS na marra").
- **Alternatives considered**: arquivo CSS importado pelo integrador — mais "correto" para SSR estrito, mas adiciona a 6ª linha e um passo esquecível; styled-components/emotion — dependência pesada e acoplamento de runtime; Tailwind — imporia build ao consumidor.

## R8. Segurança do handler (além de esconder a chave)

- **Decision**: `createWooviHandler` expõe **só dois endpoints** (criar cobrança, consultar status) e aceita um hook opcional **`beforeCreate(payload)`** onde o lojista valida ou **fixa o valor no servidor**. O README documenta que proxy sozinho não garante integridade de preço — um cliente malicioso pode pedir "cobre R$ 1" — e mostra o `beforeCreate` resolvendo isso. Também propõe formalmente à Woovi a emissão de **chave publicável** (operações inofensivas no navegador), com exemplo de como a API da biblioteca simplificaria.
- **Rationale**: É a resposta "sênior de verdade": esconder a chave resolve roubo de credencial, `beforeCreate` resolve adulteração de preço. Dois problemas distintos, e citar o segundo sem ser perguntado é diferencial.
- **Alternatives considered**: proxy transparente sem validação — vulnerável a adulteração de valor; obrigar o lojista a escrever o endpoint inteiro — mata o setup de 5 minutos.

## R9. Montagem dupla do React (StrictMode) e idempotência

- **Decision**: O `correlationID` é gerado **uma única vez por intenção de compra** (inicializador preguiçoso de ref/estado, sobrevive à montagem dupla do StrictMode). A criação usa AbortController e guarda de efeito. Se a API rejeitar `correlationID` repetido, o core faz **fallback para GET por correlationID** e segue com a cobrança existente — o comportamento fica correto quer a Woovi trate POST repetido como idempotente, quer como conflito.
- **Rationale**: Em desenvolvimento o React 18+ monta/desmonta/remonta efeitos de propósito; sem isso, cada F5 criaria duas cobranças (FR-020). O comportamento exato da Woovi com correlationID repetido será verificado no sandbox no primeiro dia de core (`scripts/criar-cobranca.mjs` já permite testar) — o design tolera ambas as respostas.
- **Alternatives considered**: desabilitar StrictMode no demo — esconde o bug em vez de resolver; flag global "já criei" — quebra com dois checkouts na vida da página.

## R10. Estratégia de testes

- **Decision**: **Vitest** + **@testing-library/react**. Núcleo da pirâmide: testes de unidade das funções puras (`transition`, `nextDelay`, formatador de contador). Hook testado com `renderHook` + fake timers + `fetch` falso injetado no core client (`createCoreClient(baseUrl, fetchImpl)`). Componentes: testes de comportamento (copiar → feedback; expirar → botão de nova cobrança). Sem E2E automatizado — o demo na Vercel + vídeo cumprem esse papel nesta entrega.
- **Rationale**: O `fetch` injetável elimina mock global e dá testes determinísticos; fake timers permitem "avançar 3s" sem esperar 3s. Vitest é o par natural do ecossistema Vite já escolhido.
- **Alternatives considered**: Jest (config extra para ESM/TS sem ganho); MSW (ótimo, mas o fetch injetado cobre o mesmo com menos peças); Playwright E2E (valor real, custo alto — cortado pelo princípio 1).

## R11. Textos e formatação

- **Decision**: Todos os textos pt-BR em `i18n/texts.ts` (um objeto, FR-022). Valores monetários formatados com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` — nativo, sem dependência. Contador exibido como `mm:ss`.
- **Rationale**: Centralizar textos custa zero e deixa i18n futura como troca de objeto; `Intl` é o padrão da plataforma para dinheiro (nunca concatenar "R$" na mão).
- **Alternatives considered**: i18next — infraestrutura para um requisito que não existe nesta entrega.

## Pendências de verificação no sandbox (não bloqueiam design)

| Item | Onde verificar | Impacto se diferente do assumido |
|---|---|---|
| Comportamento de POST /charge com `correlationID` repetido (idempotente vs erro) | `npm run cobranca` duas vezes com o mesmo ID | Nenhum — R9 tolera ambos |
| Campo de expiração retornado (`expiresIn` segundos vs `expiresDate`) | Saída do script do passo 2 | Ajuste de parsing no core, 5 linhas |
| Forma de simular pagamento no sandbox (botão no dashboard / paymentLinkUrl) | Painel do sandbox com uma cobrança ativa | Só afeta o roteiro do vídeo e do quickstart |
