# Feature Specification: PixCheckout — checkout Pix completo em cinco linhas

**Feature Branch**: `001-pixcheckout-library`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "Plano em 7 passos: (1) conta no sandbox da Woovi e chave de teste; (2) script Node que cria uma cobrança e imprime QR + copia-e-cola, sem React — camada core; (3) máquina de estados com dados falsos (criando → esperando → pago/expirado/erro) antes de ligar na API; (4) hook headless usePixCharge(); (5) componente <PixCheckout /> com QR, botão copiar com feedback, contador, copia-e-cola priorizado no celular; (6) app de exemplo (lojinha falsa) publicado na Vercel; (7) README + vídeo de 2 minutos. Baseado no guia clerkWoovi.pdf (desafio da Woovi, 'o Clerk do Pix')."

## Clarifications

### Session 2026-08-05

- Q: Como o app de exemplo (demo na Vercel) vai lidar com a chave da API — direto no navegador por ser sandbox, ou através de um backend intermediário que guarda a chave? (FR-014) → A: Modo único, sempre via backend do lojista; nenhum modo inseguro é suportado (igual Clerk/Stripe). Para o setup continuar rápido, o pacote entrega um handler de backend pronto (`createWooviHandler`) que guarda a chave e repassa as chamadas. O README propõe que a Woovi emita uma chave publicável, mostrando como a API ficaria se existisse.
- Q: Os textos que o comprador vê no checkout serão só em português, ou a biblioteca já nasce com suporte a idiomas trocáveis pelo provider? → A: Português apenas nesta entrega, com os textos centralizados em um único ponto interno (preparado para internacionalização futura, sem prop de idioma agora).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Desenvolvedor integra um checkout Pix em cinco linhas (Priority: P1)

Um desenvolvedor que nunca viu a Woovi instala a biblioteca, adiciona o handler de backend pronto (um arquivo, com a chave em variável de ambiente), envolve seu app com o provider apontando para esse handler, coloca o componente de checkout com um valor, e obtém um fluxo Pix completo: a cobrança é criada, o QR code e o código copia-e-cola aparecem, um contador de expiração roda, e quando o pagamento é confirmado o componente mostra a tela de sucesso e dispara o callback `onPaid`. Ele não escreve nenhuma lógica de cobrança, consulta de status, expiração ou tratamento de erro.

**Why this priority**: É a proposta de valor inteira do produto ("checkout completo em cinco linhas"). Sem isso não existe biblioteca — é a régua explícita do avaliador: funcionar em menos de cinco minutos, sem tutorial, bonito o suficiente para produção sem mexer no CSS.

**Independent Test**: Em um app React vazio, adicionar o handler pronto com a chave de teste em variável de ambiente, o provider apontando para ele e o componente com um valor. Verificar que o QR aparece, que pagar a cobrança no sandbox leva o componente ao estado "pago" e dispara o callback, tudo sem escrever mais nenhuma linha.

**Acceptance Scenarios**:

1. **Given** um app React com o provider configurado, **When** o componente de checkout é montado com um valor, **Then** uma cobrança é criada automaticamente e o QR code + código copia-e-cola são exibidos com contador de expiração visível.
2. **Given** o checkout exibindo uma cobrança ativa, **When** o pagamento é confirmado no sandbox, **Then** o componente muda para a tela de sucesso em poucos segundos e o callback `onPaid` recebe os dados da cobrança.
3. **Given** o checkout exibindo uma cobrança ativa, **When** o tempo de expiração termina, **Then** o componente mostra o estado "expirado" com um botão para gerar nova cobrança (nada some da tela).
4. **Given** uma falha de rede ou da API em qualquer ponto, **When** o erro ocorre, **Then** o componente mostra um estado de erro com ação de tentar novamente — nunca uma tela quebrada ou ambígua.

---

### User Story 2 - Desenvolvedor avançado usa o comportamento sem o visual (Priority: P2)

Um desenvolvedor com design próprio usa o hook headless `usePixCharge()` para obter o estado da cobrança (criando, esperando, pago, expirado, erro), os dados (código copia-e-cola, imagem do QR, tempo restante) e as ações (criar nova cobrança, tentar de novo), e constrói a própria interface por cima.

**Why this priority**: É a segunda camada da arquitetura ("core sem framework, hooks headless, componentes por cima") e o que diferencia biblioteca séria de componente fechado. O componente P1 é construído sobre este hook, então ele nasce naturalmente do mesmo trabalho.

**Independent Test**: Criar um componente de teste que usa apenas o hook e renderiza os estados como texto puro; verificar que todos os cinco estados são alcançáveis e que os dados e ações funcionam sem nenhum componente visual da biblioteca.

**Acceptance Scenarios**:

1. **Given** um componente próprio usando o hook, **When** o hook é montado, **Then** ele expõe o estado atual, os dados da cobrança e as ações, sem renderizar nada por conta própria.
2. **Given** o hook em estado "esperando pagamento", **When** o componente que o usa é desmontado, **Then** toda consulta periódica de status é interrompida imediatamente (nenhum timer ou requisição órfã continua rodando).

---

### User Story 3 - Comprador paga no celular sem fricção (Priority: P3)

Uma pessoa comprando pelo celular vê o código copia-e-cola como ação principal (não o QR code, já que não dá para apontar a câmera para a própria tela), toca em copiar, recebe confirmação visual de que copiou ("copiado ✓" por dois segundos), cola no app do banco e paga. Em tela grande, o QR code é o protagonista e o copia-e-cola é secundário.

**Why this priority**: É o detalhe de produto que o guia destaca como raro e barato — mostra que o autor pensou como quem usa, não só como quem programa. Depende de P1 existir.

**Independent Test**: Abrir o checkout em viewport móvel e verificar a hierarquia invertida (copia-e-cola primeiro); tocar em copiar e verificar o feedback temporário e o conteúdo da área de transferência.

**Acceptance Scenarios**:

1. **Given** o checkout em tela pequena, **When** a cobrança está ativa, **Then** o botão copia-e-cola aparece com destaque principal e o QR code fica secundário.
2. **Given** qualquer tela, **When** o usuário aciona o botão de copiar, **Then** o código vai para a área de transferência e o botão exibe confirmação visual por cerca de dois segundos antes de voltar ao normal.

---

### User Story 4 - Avaliador conhece o projeto pelo demo, README e vídeo (Priority: P4)

O avaliador (CTO) abre um link público com uma loja de exemplo, clica em "comprar", vê o checkout funcionando de ponta a ponta com dinheiro de mentira, e encontra no repositório um README com início rápido de cinco linhas, a explicação da arquitetura em camadas, a decisão documentada sobre a chave de API, e um vídeo de dois minutos mostrando do zero ao Pix pago.

**Why this priority**: É o empacotamento da entrega — não altera o produto, mas é o primeiro contato do avaliador e decide a primeira impressão. Depende de tudo acima existir.

**Independent Test**: Abrir o link publicado em um navegador anônimo e completar uma compra de teste; ler o README e conseguir reproduzir a integração em menos de cinco minutos.

**Acceptance Scenarios**:

1. **Given** o link público do app de exemplo, **When** o avaliador clica em comprar, **Then** o checkout abre e um pagamento de teste pode ser completado de ponta a ponta.
2. **Given** o README, **When** um desenvolvedor segue o início rápido, **Then** ele chega a um checkout funcionando copiando no máximo cinco linhas de código.
3. **Given** o README, **When** o avaliador procura a decisão sobre a chave de API, **Then** encontra a explicação de por que a chave não pode ir para o navegador e qual caminho a biblioteca adota.

---

### Edge Cases

- O que acontece quando o componente é desmontado no meio de uma consulta de status? (Toda consulta periódica deve parar e nenhum estado deve ser atualizado após o desmonte.)
- O que acontece se o usuário trocar de aba e voltar? (A consulta de status deve continuar correta — sem acumular timers nem perder a confirmação de pagamento.)
- O que acontece se o React montar o componente duas vezes seguidas (comportamento padrão em desenvolvimento)? (Não podem ser criadas duas cobranças distintas para a mesma intenção de compra.)
- O que acontece se a criação da cobrança falhar (rede fora, chave inválida)? (Estado de erro claro com ação de tentar novamente; nunca tela em branco.)
- O que acontece se o pagamento for confirmado exatamente quando o contador chega a zero? (O estado "pago" vence — dinheiro recebido nunca pode ser mostrado como "expirado".)
- O que acontece quando a cobrança expira? (A consulta de status para; botão de gerar nova cobrança aparece; a tela não se esvazia.)
- O que acontece se copiar para a área de transferência falhar (permissão negada)? (O código permanece visível e selecionável como alternativa.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A biblioteca MUST fornecer um provider que recebe o endereço do backend do lojista e o disponibiliza aos componentes filhos; a chave de acesso vive somente nesse backend e nunca é aceita por código que roda no navegador.
- **FR-002**: O checkout MUST criar uma cobrança automaticamente ao ser montado, a partir apenas do valor informado pelo integrador.
- **FR-003**: O checkout MUST se comportar como uma máquina de estados explícita com exatamente estes estados: criando, esperando pagamento, pago, expirado e erro — cada um com interface própria e sem estados ambíguos ou sobrepostos.
- **FR-004**: Enquanto estiver em "esperando pagamento", o sistema MUST consultar o status da cobrança periodicamente e MUST parar de consultar assim que a cobrança for paga ou expirar.
- **FR-005**: Ao ser desmontado, o componente MUST interromper toda consulta pendente e limpar todos os timers (nenhum vazamento após sair da tela).
- **FR-006**: A confirmação de pagamento MUST ser refletida na interface e disparar o callback `onPaid` com os dados da cobrança.
- **FR-007**: O checkout MUST exibir o QR code, o código copia-e-cola e um contador de expiração visível durante a espera do pagamento.
- **FR-008**: O botão de copiar MUST colocar o código na área de transferência e exibir confirmação visual temporária (~2 segundos).
- **FR-009**: Em telas pequenas, o código copia-e-cola MUST ter prioridade visual sobre o QR code; em telas grandes, o inverso.
- **FR-010**: No estado "expirado", o checkout MUST oferecer uma ação de gerar nova cobrança sem que o integrador escreva nada.
- **FR-011**: Em qualquer falha, o checkout MUST apresentar estado de erro com ação de tentar novamente.
- **FR-012**: A biblioteca MUST expor um hook headless (`usePixCharge()`) que entrega estado, dados e ações sem renderizar interface.
- **FR-013**: A lógica de comunicação com a API (criar cobrança, consultar status) MUST funcionar fora do React (camada core independente de framework, utilizável em Node).
- **FR-014**: A chave de acesso MUST NOT ser exposta em código de navegador em nenhum modo de uso — não existe modo inseguro suportado. Toda comunicação com a Woovi passa pelo backend do lojista. O README MUST documentar essa decisão e MUST propor à Woovi a emissão de uma chave publicável, ilustrando como a API da biblioteca ficaria se ela existisse.
- **FR-021**: A biblioteca MUST entregar um handler de backend pronto (`createWooviHandler`) que o integrador instala em um arquivo do seu servidor com a chave em variável de ambiente, preservando o objetivo de setup completo em menos de 5 minutos.
- **FR-022**: Todos os textos exibidos ao comprador MUST estar em português (pt-BR) e centralizados em um único ponto interno da biblioteca; nenhum texto fica espalhado dentro dos componentes.
- **FR-015**: A aparência MUST ser personalizável via uma prop `appearance` (ao menos cor principal, raio de borda e fonte), sem o integrador sobrescrever CSS interno.
- **FR-016**: O estado de carregamento MUST usar esqueleto (skeleton) no formato do conteúdo final, não um spinner isolado.
- **FR-017**: Cada estado do checkout MUST ter uma história correspondente no catálogo de componentes (Storybook).
- **FR-018**: Um app de exemplo (loja fictícia com botão de comprar) MUST estar publicado em URL pública.
- **FR-019**: O README MUST conter um início rápido em que a integração completa cabe em cinco linhas de código.
- **FR-020**: Remontagens imediatas do componente para a mesma intenção de compra MUST NOT criar cobranças duplicadas.

### Key Entities

- **Cobrança (Charge)**: uma intenção de pagamento Pix; atributos-chave: identificador de correlação (escolhido pela biblioteca), valor em centavos, status (ativa, concluída, expirada), código copia-e-cola, imagem do QR code, tempo de expiração.
- **Estado do checkout**: a situação atual do fluxo (criando, esperando, pago, expirado, erro); deriva da cobrança e das falhas de comunicação; determina integralmente o que é exibido.
- **Aparência (appearance)**: conjunto de preferências visuais do integrador (cor principal, raio de borda, fonte) aplicado a todos os componentes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um desenvolvedor que nunca viu a biblioteca chega a um checkout Pix funcionando em menos de 5 minutos a partir do README, sem ler tutorial externo.
- **SC-002**: A integração mínima exige no máximo 5 linhas de código e zero configuração visual para ficar apresentável em produção.
- **SC-003**: A confirmação de pagamento aparece na tela em no máximo 10 segundos após o pagamento no sandbox.
- **SC-004**: Após pagamento, expiração ou desmonte do componente, nenhuma consulta de status adicional é feita (verificável observando o tráfego de rede).
- **SC-005**: Os 5 estados do checkout são demonstráveis individualmente no catálogo de componentes, sem depender da API real.
- **SC-006**: Uma compra de teste completa (abrir loja de exemplo → pagar → ver confirmação) é realizável de ponta a ponta por qualquer pessoa com o link público.
- **SC-007**: O fluxo em tela pequena permite copiar o código com um toque e receber confirmação visual, sem precisar do QR code.

## Assumptions

- Todo o desenvolvimento e a demonstração usam o ambiente sandbox da Woovi (dinheiro fictício); nenhum pagamento real está em escopo.
- Valores monetários são tratados em centavos (inteiros), padrão do setor de pagamentos.
- Escopo deliberadamente limitado conforme o guia: um único componente de checkout impecável; ficam fora suporte a outros frameworks (Vue/Svelte), publicação no npm com versionamento/pipeline, assinatura recorrente, split, boleto e cartão.
- A confirmação de pagamento chega ao navegador por consulta periódica de status (webhooks não alcançam código de navegador); um webhook opcional via backend do lojista é aprimoramento futuro, não requisito.
- O app de exemplo usa o handler de backend pronto (FR-021) em uma função de servidor própria, com a chave de sandbox em variável de ambiente — o mesmo caminho recomendado para produção, sem atalho inseguro.
- Um único checkout/cobrança ativa por vez; múltiplos checkouts simultâneos na mesma página estão fora do escopo desta entrega.
- O vídeo de 2 minutos é gravado pelo autor ao final; a especificação cobre apenas os artefatos de software que o vídeo demonstra.
- Internacionalização (outros idiomas) está fora do escopo desta entrega; a centralização dos textos (FR-022) deixa o caminho preparado sem custo adicional.
