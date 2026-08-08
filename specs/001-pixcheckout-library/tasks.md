# Tasks: PixCheckout — checkout Pix completo em cinco linhas

**Input**: Design documents from `/specs/001-pixcheckout-library/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUÍDOS — a spec e o quickstart definem testes explicitamente (SC-004 "zero requisições após parada", SC-005 "estados demonstráveis sem API", Cenário 1 do quickstart lista os testes esperados), e o guia do desafio manda "trabalhar em pedaços pequenos, testando entre um e outro".

**Organization**: Tarefas agrupadas por user story. Executor solo: seguir na ordem; os marcadores [P] indicam o que pode ser feito fora de ordem sem conflito.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo funcionando com pacote da biblioteca, testes e Storybook prontos para receber código.

- [X] T001 Converter a raiz em npm workspaces: editar `package.json` da raiz (workspaces `["packages/*", "examples/*"]`, scripts `test`/`storybook` delegando ao pacote), preservando o script `cobranca` existente
- [X] T002 Criar `packages/pixcheckout/package.json` (name `pixcheckout`, type module, exports `.`/`./core`/`./server` apontando para src/, peerDependencies react ≥18, dependency `uqr`) e `packages/pixcheckout/tsconfig.json` (strict, jsx react-jsx, noEmit)
- [X] T003 [P] Configurar Vitest + Testing Library em `packages/pixcheckout/vitest.config.ts` e `packages/pixcheckout/src/test-setup.ts` (environment jsdom, globals, cleanup)
- [X] T004 [P] Inicializar Storybook (builder Vite, framework react-vite) em `packages/pixcheckout/.storybook/main.ts` e `preview.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: A camada core inteira (tipos, cliente, máquina, agenda de polling, textos) — tudo que roda sem React e que todas as histórias consomem.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase terminar.

- [X] T005 Criar `packages/pixcheckout/src/core/types.ts`: `Charge`, `ChargeStatus`, `CheckoutState` (união discriminada), `CheckoutEvent`, `PixError`/`PixApiError`/`PixValidationError` — exatamente como em data-model.md
- [X] T006 Criar `packages/pixcheckout/src/core/client.ts`: `createCoreClient(baseUrl, { fetch?, headers? })` com `createCharge`/`getCharge`, normalização da resposta (mapa de status, `expiresIn`/`expiresDate` → `expiresAt` epoch ms), validação de `value` inteiro > 0, fallback GET quando POST devolve conflito de correlationID (R9), erros tipados — contrato em contracts/woovi-api.md
- [X] T007 [P] Criar `packages/pixcheckout/src/core/machine.ts`: `transition(state, event)` puro implementando a tabela completa de data-model.md (incluindo "pago vence expirado"; evento não mapeado → estado inalterado)
- [X] T008 [P] Criar `packages/pixcheckout/src/core/polling.ts`: `nextDelay(elapsedMs)` (3_000 até 120_000ms, depois 10_000) e constante `MAX_CONSECUTIVE_FAILURES = 3` (R5)
- [X] T009 [P] Criar `packages/pixcheckout/src/i18n/texts.ts`: objeto único com todos os textos pt-BR (FR-022) + `formatBRL(cents)` via `Intl.NumberFormat` + `formatCountdown(ms)` → `mm:ss`
- [X] T010 [P] Testes das funções puras: `packages/pixcheckout/src/core/machine.test.ts` (todas as células da tabela de transições) e `packages/pixcheckout/src/core/polling.test.ts` (fronteira 3s→10s aos 2min)
- [X] T011 Verificação no sandbox (quickstart Cenário 0): rodar `npm run cobranca` duas vezes com o mesmo correlationID; registrar em research.md as respostas das 3 pendências ⚠ (idempotência do POST, campo de expiração real, como simular pagamento); ajustar normalização em `src/core/client.ts` se necessário. *Pré-condição: AppID no `.env`*

**Checkpoint**: Core provado contra a API real; máquina 100% testada sem React.

---

## Phase 3: User Story 1 - Desenvolvedor integra um checkout Pix em cinco linhas (Priority: P1) 🎯 MVP

**Goal**: `<WooviProvider>` + `<PixCheckout amount onPaid />` funcionando de ponta a ponta com os 5 estados, sobre o handler seguro.

**Independent Test**: quickstart Cenários 1 e 2 — testes verdes (parada/cleanup/StrictMode) e as 5 histórias no Storybook renderizando offline.

- [X] T012 [US1] Criar `packages/pixcheckout/src/server/handler.ts`: `createWooviHandler({ appId, baseUrl?, beforeCreate? })` → `(Request) => Promise<Response>` com os 2 endpoints, formato de erro único, throw na inicialização sem appId, sem vazar detalhes da Woovi — contrato em contracts/server-handler.md
- [X] T013 [P] [US1] Testes do handler em `packages/pixcheckout/src/server/handler.test.ts`: rota desconhecida → 404, `beforeCreate` substitui payload (fixa preço), appId ausente lança, corpo inválido → 400 `validation`, resposta de erro não contém o appId
- [X] T014 [US1] Criar `packages/pixcheckout/src/react/theme.ts`: stylesheet única da biblioteca (classes `pixck-*`, CSS variables `--pixck-*` com defaults apresentáveis), `appearanceToVars(appearance)`, injeção idempotente da tag `<style>` (R7)
- [X] T015 [US1] Criar `packages/pixcheckout/src/react/WooviProvider.tsx`: contexto com `endpoint` + `appearance` + client core criado a partir do endpoint (aceita client injetável para testes/histórias), injeta stylesheet, erro claro se hook/componente usado fora do provider
- [X] T016 [US1] Criar `packages/pixcheckout/src/react/usePixCharge.ts`: correlationID preguiçoso por intenção (sobrevive StrictMode), criação com AbortController, polling com `setTimeout` encadeado usando `nextDelay`, pausa/checagem via `visibilitychange`, contador derivado de `expiresAt` com checagem final ao zerar, contador de falhas consecutivas, ações `retry`/`newCharge` (novo correlationID), `onPaid`/`onExpired` disparados uma única vez, cleanup total no desmonte — retorno conforme contracts/react-api.md
- [X] T017 [US1] Testes do hook em `packages/pixcheckout/src/react/usePixCharge.test.tsx` (fake timers + client falso): montagem dupla StrictMode cria UMA cobrança; polling para após paid e após expired; zero chamadas/timers após desmonte; 3 falhas seguidas → error, sucesso no meio zera o contador; pago-vence-expirado na checagem final
- [X] T018 [P] [US1] Criar subcomponentes: `packages/pixcheckout/src/react/PixQRCode.tsx` (SVG local via uqr a partir do brCode), `packages/pixcheckout/src/react/PixCopyButton.tsx` (clipboard + "copiado ✓" por 2s — FR-008), `packages/pixcheckout/src/react/PixStatus.tsx` (contador mm:ss + valor formatado)
- [X] T019 [US1] Criar `packages/pixcheckout/src/react/PixCheckout.tsx`: compõe provider/hook/subcomponentes nas 5 interfaces de estado (skeleton no creating — FR-016; sucesso; expirado com botão nova cobrança; erro com retry), aplica appearance, props conforme contracts/react-api.md
- [X] T020 [US1] Testes de comportamento em `packages/pixcheckout/src/react/PixCheckout.test.tsx`: creating mostra skeleton; copiar → feedback 2s (fake timers); expirado → clicar "gerar nova cobrança" → creating; erro → "tentar de novo" → creating
- [X] T021 [US1] Criar `packages/pixcheckout/src/index.ts` (superfície pública: provider, hook, 4 componentes, tipos) e conferir subpaths `pixcheckout/core` e `pixcheckout/server`; `npx tsc --noEmit` limpo no pacote
- [X] T022 [US1] Storybook: `packages/pixcheckout/src/react/PixCheckout.stories.tsx` com uma história por estado (dados falsos via client injetado, sem rede — SC-005) + uma história com `appearance` customizada (FR-015)

**Checkpoint**: MVP pronto — biblioteca funciona, estados demonstráveis, decisão de segurança implementada.

---

## Phase 4: User Story 2 - Desenvolvedor avançado usa o comportamento sem o visual (Priority: P2)

**Goal**: Provar que `usePixCharge()` e o core sustentam uma UI própria — o caminho headless do contrato.

**Independent Test**: história/teste que renderiza os 5 estados como texto puro usando SÓ o hook; script Node consumindo só o core.

- [X] T023 [US2] Criar `packages/pixcheckout/src/react/Headless.stories.tsx`: os 5 estados renderizados como texto puro usando apenas `usePixCharge()` + client falso (nenhum componente visual da biblioteca importado) — é também o passo 4 do guia ("renderize cada estado como texto")
- [X] T024 [P] [US2] Reescrever `scripts/criar-cobranca.mjs` para importar `createCoreClient` de `pixcheckout/core` — prova FR-013 (core roda em Node puro) mantendo a saída atual
- [X] T025 [US2] Teste de integração headless em `packages/pixcheckout/src/react/headless.test.tsx`: componente de texto puro percorre creating → awaiting → paid só com o hook; asserção de que `pixcheckout` exporta `usePixCharge`, tipos e nada interno vaza

**Checkpoint**: Camadas 1 e 2 utilizáveis sozinhas, com prova executável.

---

## Phase 5: User Story 3 - Comprador paga no celular sem fricção (Priority: P3)

**Goal**: Hierarquia mobile invertida (copia-e-cola primeiro), feedback de cópia robusto, fallback quando clipboard falha.

**Independent Test**: quickstart Cenário 2 (história mobile) — viewport < 640px mostra copia-e-cola antes do QR; cópia negada ainda permite pagar.

- [X] T026 [US3] CSS responsivo em `packages/pixcheckout/src/react/theme.ts`: media query < 640px inverte a ordem (copia-e-cola principal, QR secundário — FR-009), alvos de toque ≥44px, contador legível em tela pequena
- [X] T027 [US3] Fallback de clipboard em `packages/pixcheckout/src/react/PixCopyButton.tsx`: `navigator.clipboard` rejeitado → exibe o código completo selecionável com instrução de copiar manualmente (edge case da spec); teste do fallback em `PixCheckout.test.tsx`
- [X] T028 [P] [US3] História mobile em `packages/pixcheckout/src/react/PixCheckout.stories.tsx` (parâmetro viewport mobile) + teste da ordem do DOM na variante mobile

**Checkpoint**: Experiência do comprador completa nos dois formatos de tela.

---

## Phase 6: User Story 4 - Avaliador conhece o projeto pelo demo, README e vídeo (Priority: P4)

**Goal**: O link que o Sibelius abre: loja fake na Vercel + README que ensina em 5 minutos + vídeo de 2 minutos.

**Independent Test**: quickstart Cenários 3, 4 e 5 — compra de teste ponta a ponta no link público; README reproduzível em < 5 min.

- [X] T029 [US4] Scaffold do demo em `examples/loja/`: Next.js 16 App Router, TypeScript, dependência `pixcheckout` via workspace, `transpilePackages: ["pixcheckout"]` em `examples/loja/next.config.ts`
- [X] T030 [US4] Handler montado em `examples/loja/app/api/pix/[...path]/route.ts`: `createWooviHandler` com `WOOVI_APP_ID` de env e `beforeCreate` fixando o preço no servidor (integridade de preço — R8); `examples/loja/.env.local.example`
- [X] T031 [US4] Páginas da loja: `examples/loja/app/page.tsx` (produto fictício + botão comprar), `examples/loja/app/checkout/page.tsx` (as cinco linhas literais), `examples/loja/app/obrigado/page.tsx` (destino do `onPaid`)
- [X] T032 [US4] Validação local ponta a ponta (quickstart Cenário 3): pagar no sandbox, confirmar UI paga em ≤10s, Network mostra polling cessando e AppID ausente do navegador; registrar evidências (screenshots) em `specs/001-pixcheckout-library/evidencias/`
- [X] T033 [US4] Deploy na Vercel: projeto `examples/loja` com `WOOVI_APP_ID` nas env vars, testar o fluxo completo em aba anônima (Cenário 5), anotar a URL pública no README
- [X] T034 [US4] Escrever `README.md` (raiz): início rápido de 5 linhas + arquivo do handler, arquitetura em camadas ("core sem framework, hooks headless, componentes por cima"), decisão da chave (sem modo inseguro) + proposta de publishable key à Woovi com API hipotética, `beforeCreate`/integridade de preço, decisões de polling, como rodar testes/Storybook/demo, link do demo e do vídeo
- [X] T035 [P] [US4] Roteiro do vídeo de 2 min em `docs/video-roteiro.md`: do `create-next-app` ao Pix pago (Cenário 4 + pagamento do Cenário 3), com marcações de tempo
- [ ] T036 [US4] Gravar o vídeo seguindo o roteiro (tarefa do autor), publicar (YouTube não listado ou arquivo no repo) e linkar no `README.md`

**Checkpoint**: Entrega completa navegável por um estranho sem ajuda.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T037 Acessibilidade em `packages/pixcheckout/src/react/`: `aria-live="polite"` nas mudanças de estado, labels nos botões, foco visível, contraste dos defaults do tema
- [ ] T038 [P] Teste dos cinco minutos (quickstart Cenário 4): app Next limpo fora do monorepo, seguir só o README com cronômetro; corrigir o README onde travar
- [X] T039 Limpeza final: `npx tsc --noEmit` no pacote e no demo, remover código morto e comentários de rascunho, nomes consistentes em pt-BR nos textos e en nos identificadores
- [ ] T040 Validação final: percorrer quickstart.md inteiro (Cenários 0–5) e marcar o checklist de entrega do guia; pendências viram issues no README ou são resolvidas

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende do Setup; T011 depende também do AppID no `.env` (ação do autor) — T005–T010 não bloqueiam por isso
- **US1 (Phase 3)**: depende da Phase 2; dentro dela: T012→T013; T014→T015→T016→T017; T016+T018→T019→T020; T019→T021→T022
- **US2 (Phase 4)**: depende de T016 (hook) e T021 (exports); não depende do visual (T018–T020)
- **US3 (Phase 5)**: depende de T018/T019 (componentes existirem)
- **US4 (Phase 6)**: depende do checkpoint US1 (T029–T031 podem começar ali); T032 depende de T030+T031; T033 depende de T032; T034 depende de T033; T036 depende de T035
- **Polish (Phase 7)**: depende de todas as histórias desejadas

### Parallel Opportunities

- Phase 1: T003 ∥ T004 (após T002)
- Phase 2: T007 ∥ T008 ∥ T009 ∥ T010 (após T005; T010 conforme T007/T008 terminam); T011 independe de T007–T010
- US1: T013 ∥ T014; T018 ∥ T016; T022 ∥ T020
- US2 inteira ∥ US3 inteira (arquivos distintos, após US1)
- T035 ∥ T029–T033

## Implementation Strategy

**MVP = Phase 1 + 2 + US1** (T001–T022). Nesse ponto existe uma biblioteca defensável: estados no Storybook, testes de parada/cleanup verdes, handler seguro. É o mínimo que já sustenta uma conversa técnica.

**Entrega incremental na ordem das fases** — cada checkpoint é demonstrável por si. Se o prazo apertar depois do MVP: US4 (demo + README) passa na frente de US2/US3, porque é o que o avaliador abre primeiro; dentro de US4, o vídeo (T035/T036) é o último a cair, o Storybook extra é o primeiro (decisão já registrada na conversa: Storybook é a primeira coisa a cortar).

**Mapa para o ritmo do guia (10 dias)**: dias 1–2 = Phases 1–2 · dias 3–4 = T012–T017 (lógica sem visual) · dias 5–7 = T018–T022 + US3 · dia 8 = US2 + histórias restantes · dia 9 = T029–T033 · dia 10 = T034–T036 + Polish.

## Notes

- Testes ficam ao lado do código (`*.test.ts[x]`) — convenção Vitest do plano
- Commits pequenos por tarefa ou grupo lógico (checklist do guia: "commits pequenos e com mensagem clara")
- T011 e T036 exigem ação do autor (AppID no `.env`; gravar vídeo) — todo o resto é executável por agente
