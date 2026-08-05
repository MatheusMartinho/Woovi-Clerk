# Implementation Plan: PixCheckout — checkout Pix completo em cinco linhas

**Branch**: `001-pixcheckout-library` | **Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-pixcheckout-library/spec.md`

## Summary

Biblioteca React que entrega um checkout Pix completo em cinco linhas, organizada em camadas: **core** TypeScript puro (cliente da API Woovi + máquina de estados como função pura), **hook headless** `usePixCharge()` (orquestra criação, polling e cleanup), **componentes** (`<PixCheckout />` e subcomponentes) e **provider** (`<WooviProvider />`). A decisão de arquitetura central, fixada na clarificação: **a chave da API nunca toca o navegador** — todo tráfego passa pelo backend do lojista, e a biblioteca entrega esse backend pronto via `createWooviHandler` (padrão Web Request/Response, funciona em Next.js/Vercel/Node). Demo: loja fictícia em Next.js publicada na Vercel. Confirmação de pagamento por polling com parada e cleanup corretos; pt-BR apenas, textos centralizados.

## Technical Context

**Language/Version**: TypeScript 5.x (strict); Node 22 LTS local; navegadores evergreen

**Primary Dependencies**: React ≥18 (peer dependency; demo roda React 19 via Next.js 16). Runtime da biblioteca: apenas `uqr` (geração de QR em SVG, ~4KB). Dev: Vite, Vitest, @testing-library/react, Storybook (builder Vite), Next.js 16 (só no app de exemplo)

**Storage**: N/A — a API da Woovi é a fonte de verdade das cobranças; a biblioteca não persiste nada

**Testing**: Vitest + Testing Library; fake timers para polling; `fetch` injetável no core (testes sem rede); funções puras (reducer, agenda de polling, formatação) testadas diretamente

**Target Platform**: Navegadores modernos (componentes/hook); Node ≥18 e runtimes Vercel para o subpath `pixcheckout/server`; core roda em ambos

**Project Type**: Biblioteca (monorepo npm workspaces: pacote da biblioteca + app de exemplo)

**Performance Goals**: Pagamento refletido na UI em ≤10s (SC-003); ≤1 requisição de status por intervalo por checkout (sem sobreposição); zero requisições após paid/expired/unmount (SC-004); bundle da biblioteca pequeno (única dependência de runtime é o gerador de QR)

**Constraints**: Chave da API só em variável de ambiente do servidor — sem modo inseguro (FR-014); setup ≤5 min com ≤5 linhas no frontend + 1 arquivo de handler (SC-001/SC-002, FR-021); pt-BR apenas, textos centralizados (FR-022); sem publicação no npm, sem Vue/Svelte, sem boleto/cartão/split (escopo negativo)

**Scale/Scope**: Um checkout ativo por página; 5 estados de UI; ~10 dias de execução; entrega = biblioteca + Storybook + demo na Vercel + README + vídeo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` é o template não ratificado — não há princípios formais para aplicar. **Gate: PASS (vácuo).** Na ausência de constituição, o plano adota como princípios de trabalho as regras do guia do desafio, que funcionam como constituição de fato:

1. **Um componente redondo > seis capengas** — qualquer proposta de escopo novo é rejeitada por padrão.
2. **Lógica antes de visual** — máquina de estados pura e testável antes de qualquer CSS.
3. **Camadas com fronteiras reais** — core sem React; React sem chave; servidor sem UI.
4. **Sem dependência que não se pague** — cada dependência de runtime precisa de justificativa escrita (hoje só `uqr`).

**Re-check pós-design (Fase 1): PASS** — nenhuma violação; Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/001-pixcheckout-library/
├── spec.md              # Especificação (feita)
├── plan.md              # Este arquivo
├── research.md          # Fase 0: decisões técnicas com alternativas
├── data-model.md        # Fase 1: entidades + máquina de estados
├── quickstart.md        # Fase 1: guia de validação ponta a ponta
├── contracts/
│   ├── react-api.md     # Superfície pública React (provider, hook, componentes)
│   ├── server-handler.md# Contrato do createWooviHandler + endpoints HTTP
│   └── woovi-api.md     # Subconjunto da API Woovi que o core consome
└── tasks.md             # Fase 2 (/speckit-tasks — ainda não criado)
```

### Source Code (repository root)

```text
package.json                  # raiz: npm workspaces ["packages/*", "examples/*"]
scripts/
└── criar-cobranca.mjs        # smoke test manual da API (já existe; passo 2 do guia)

packages/pixcheckout/         # A BIBLIOTECA (pacote único, três subpaths)
├── package.json              # exports: ".", "./core", "./server"; peer: react ≥18
├── src/
│   ├── core/                 # camada 1 — TypeScript puro, zero React
│   │   ├── types.ts          # Charge, ChargeStatus, erros
│   │   ├── client.ts         # createCoreClient(baseUrl, fetch?) → createCharge/getCharge
│   │   ├── machine.ts        # transition(state, event) — reducer puro dos 5 estados
│   │   └── polling.ts        # nextDelay(elapsed), política de falhas — funções puras
│   ├── react/                # camadas 0, 2 e 3
│   │   ├── WooviProvider.tsx # contexto: endpoint do handler + appearance
│   │   ├── usePixCharge.ts   # hook headless: reducer + efeitos (criar, polling, countdown, cleanup)
│   │   ├── PixCheckout.tsx   # componente completo (compõe os de baixo)
│   │   ├── PixQRCode.tsx     # QR SVG local via uqr
│   │   ├── PixCopyButton.tsx # copia-e-cola + feedback "copiado ✓" 2s
│   │   ├── PixStatus.tsx     # contador/estado
│   │   └── theme.ts          # appearance → CSS variables; stylesheet injetada
│   ├── server/
│   │   └── handler.ts        # createWooviHandler({ appId, beforeCreate? }) — Web Request/Response
│   ├── i18n/
│   │   └── texts.ts          # FR-022: todos os textos pt-BR num único objeto
│   └── index.ts              # re-exports da superfície pública
├── src/**/*.test.ts(x)       # Vitest ao lado do código
└── .storybook/               # uma história por estado (builder Vite)

examples/loja/                # DEMO publicado na Vercel
├── package.json              # depende de "pixcheckout" via workspace
├── next.config.ts            # transpilePackages: ["pixcheckout"]
└── app/
    ├── page.tsx              # lojinha fictícia com botão comprar
    ├── checkout/page.tsx     # <WooviProvider> + <PixCheckout /> (as 5 linhas)
    └── api/pix/[...path]/route.ts  # export do createWooviHandler (chave em env var)
```

**Structure Decision**: Monorepo com npm workspaces (nativo do npm, sem ferramenta extra) contendo **um único pacote de biblioteca** com três subpath exports (`pixcheckout`, `pixcheckout/core`, `pixcheckout/server`) em vez de três pacotes separados — as fronteiras entre camadas são diretórios + regra de import (core não importa de react/), o que preserva a arquitetura sem o custo de versionar três pacotes. O app de exemplo consome o código-fonte TypeScript direto do workspace (sem etapa de build de distribuição, já que publicar no npm está fora do escopo). Justificativas completas e alternativas rejeitadas em [research.md](./research.md).

## Complexity Tracking

Sem violações da constituição — tabela vazia.
