/**
 * Smoke test manual da API (quickstart Cenário 0) — agora consumindo a
 * PROPRIA camada core da biblioteca em Node puro, o que prova o FR-013:
 * "core sem framework, utilizavel fora do React".
 *
 * Rodar:  npm run cobranca
 * Idempotencia (T011): CORRELATION_ID=algum-uuid npm run cobranca  (2x)
 */
import { createCoreClient } from '../packages/pixcheckout/src/core/index.ts';
import { formatBRL } from '../packages/pixcheckout/src/i18n/texts.ts';

try {
  process.loadEnvFile('.env');
} catch {
  console.error('Nao achei o arquivo .env. Rode primeiro: cp .env.example .env');
  process.exit(1);
}

const APP_ID = process.env.WOOVI_APP_ID;
const BASE_URL = process.env.WOOVI_BASE_URL ?? 'https://api.woovi-sandbox.com';

if (!APP_ID || APP_ID.startsWith('cole_seu')) {
  console.error('Falta o WOOVI_APP_ID no arquivo .env. Rode: cp .env.example .env');
  process.exit(1);
}

// O MESMO client que o navegador usa apontando pro handler — aqui apontando
// direto pra Woovi, com a chave, porque estamos no lado seguro (um terminal).
const woovi = createCoreClient(`${BASE_URL}/api/v1`, {
  headers: { Authorization: APP_ID, 'Content-Type': 'application/json' },
});

const correlationID = process.env.CORRELATION_ID ?? crypto.randomUUID();

const cobranca = await woovi.createCharge({
  correlationID,
  value: 5000, // centavos: R$ 50,00
  comment: 'Teste PixCheckout',
});

console.log('\n=== COBRANCA CRIADA (ou recuperada, se o ID ja existia) ===');
console.log('correlationID :', cobranca.correlationID);
console.log('status        :', cobranca.status);
console.log('valor         :', formatBRL(cobranca.value));
console.log('expira em     :', Math.round((cobranca.expiresAt - Date.now()) / 1000), 'segundos');
console.log('link          :', cobranca.paymentLinkUrl);
console.log('\ncopia e cola (brCode):');
console.log(cobranca.brCode);

const consultada = await woovi.getCharge(cobranca.correlationID);
console.log('\n=== CONSULTA DE STATUS ===');
console.log('status agora  :', consultada.status);
console.log('\n(ACTIVE = esperando pagamento. Vira COMPLETED quando pagar.)');
