# Roteiro do vídeo — 2 minutos, do zero ao Pix pago

Gravar a tela inteira (terminal + navegador). Ensaiar uma vez antes; o vídeo vale mais que o README (guia do desafio). Sem edição sofisticada: um take honesto.

## Preparação (antes de gravar)

- [ ] Conta sandbox logada em app.woovi-sandbox.com (aba aberta)
- [ ] AppID copiado para a área de transferência secundária (ou anotado)
- [ ] `npm run dev` já testado uma vez hoje (para o cache do Next estar quente)
- [ ] Fechar notificações/abas pessoais

## Take (marcações de tempo)

**0:00 – 0:15 · O gancho.**
Tela no README, dizer:
> "Isto é o PixCheckout: um checkout Pix completo em cinco linhas de React — a ideia do Clerk, aplicada ao Pix da Woovi. Vou mostrar do zero ao Pix pago."

**0:15 – 0:45 · O código que o dev escreve.**
Abrir `examples/loja/app/api/pix/[...path]/route.ts`:
> "O dev cria UM arquivo de backend: o handler pronto da biblioteca. A chave fica em variável de ambiente — nunca no navegador; a biblioteca nem tem modo inseguro."

Abrir `examples/loja/app/checkout/page.tsx`:
> "E cola estas cinco linhas. Só isso."

**0:45 – 1:30 · Funcionando.**
Navegador em `localhost:3000` → clicar **Comprar com Pix**:
> "Skeleton enquanto cria… e pronto: QR, copia-e-cola com feedback, contador. No celular o copia-e-cola vem primeiro — ninguém aponta a câmera pra própria tela."

(Estreitar a janela pra mostrar a inversão mobile. Clicar em copiar → "Copiado ✓".)

Abrir o painel do sandbox → achar a cobrança → **pagar/simular pagamento**.
Voltar pra loja SEM tocar em nada:
> "Sem refresh: o componente consulta o status — 3 segundos nos primeiros minutos, com pausa quando a aba está oculta — e…"

Tela vira "Pagamento confirmado" e navega para /obrigado:
> "…pago. O onPaid disparou e a loja seguiu o fluxo dela."

**1:30 – 2:00 · Fechamento técnico.**
Voltar ao README (seção da máquina de estados):
> "Por baixo: core TypeScript puro com a máquina de estados como função pura, hook headless pra quem tem design próprio, e os componentes por cima. Cinquenta testes, Storybook com um estado por história, e uma proposta concreta pra Woovi: chave publicável, estilo Stripe. Obrigado!"

## Publicação

- YouTube **não listado** (ou arquivo `demo.mp4` no repo se < 50 MB)
- Colar o link no topo do README (placeholder `🎬 Vídeo de 2 min`)
