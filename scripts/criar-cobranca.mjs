/**
 * Passo 2 do plano: provar que entendemos a API da Woovi, sem React nenhum.
 *
 * Este script faz as tres coisas que o guia manda descobrir:
 *   1. como criar uma cobranca
 *   2. o que ela devolve (o codigo copia e cola e a imagem do QR)
 *   3. como consultar o status pelo correlationID
 *
 * Rodar com:  npm run cobranca
 */

// Le o arquivo .env e joga tudo em process.env. Nativo do Node 20+,
// por isso este script nao tem nenhuma dependencia instalada.
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

/**
 * O AppID vai cru no header Authorization, sem o prefixo "Bearer".
 * Esse e o detalhe que faz a maioria das pessoas tomar 401 na primeira tentativa.
 */
const headers = {
  Authorization: APP_ID,
  'Content-Type': 'application/json',
};

async function criarCobranca({ value, comment }) {
  // O correlationID e o nosso identificador da cobranca. Quem escolhe somos nos,
  // nao a Woovi. E por ele que consultamos o status depois, e e ele que torna a
  // criacao idempotente: mandar o mesmo correlationID duas vezes nao gera duas
  // cobrancas, devolve a mesma. Isso importa quando o React remonta o componente.
  const correlationID = crypto.randomUUID();

  const response = await fetch(`${BASE_URL}/api/v1/charge`, {
    method: 'POST',
    headers,
    // value e em CENTAVOS. 5000 = R$ 50,00. Dinheiro nunca em decimal.
    body: JSON.stringify({ correlationID, value, comment }),
  });

  if (!response.ok) {
    throw new Error(`Erro ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function consultarCobranca(correlationID) {
  const response = await fetch(
    `${BASE_URL}/api/v1/charge/${encodeURIComponent(correlationID)}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error(`Erro ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

// --- execucao ---

const criada = await criarCobranca({ value: 5000, comment: 'Teste PixCheckout' });
const cobranca = criada.charge;

console.log('\n=== COBRANCA CRIADA ===');
console.log('correlationID :', cobranca.correlationID);
console.log('status        :', cobranca.status);
console.log('valor         : R$', (cobranca.value / 100).toFixed(2));
console.log('expira em     :', cobranca.expiresIn, 'segundos');
console.log('link          :', cobranca.paymentLinkUrl);
console.log('imagem do QR  :', cobranca.qrCodeImage);
console.log('\ncopia e cola (brCode):');
console.log(cobranca.brCode);

const consultada = await consultarCobranca(cobranca.correlationID);
console.log('\n=== CONSULTA DE STATUS ===');
console.log('status agora  :', consultada.charge.status);
console.log('\n(ACTIVE = esperando pagamento. Vira COMPLETED quando pagar.)');

// Descomente para ver a resposta inteira e descobrir os outros campos:
// console.log(JSON.stringify(criada, null, 2));
