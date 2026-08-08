/**
 * FERRAMENTA DE DEMONSTRAÇÃO — existe só nesta loja de exemplo, nunca na
 * biblioteca. Numa loja real o comprador paga no app do banco; aqui, o
 * avaliador clica num botão e este endpoint simula o pagamento usando o
 * endpoint de teste do sandbox da Woovi.
 *
 * Roda no servidor pelo mesmo motivo de sempre: precisa do AppID.
 */
const SANDBOX_URL = 'https://api.woovi-sandbox.com';

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { correlationID?: unknown } | null;
  if (!body || typeof body.correlationID !== 'string') {
    return Response.json({ error: 'correlationID obrigatório' }, { status: 400 });
  }

  const appId = process.env.WOOVI_APP_ID;
  if (!appId) {
    return Response.json({ error: 'WOOVI_APP_ID ausente no servidor' }, { status: 500 });
  }

  // o endpoint de teste precisa do transactionID, não do correlationID
  const chargeRes = await fetch(
    `${SANDBOX_URL}/api/v1/charge/${encodeURIComponent(body.correlationID)}`,
    { headers: { Authorization: appId } },
  );
  if (!chargeRes.ok) {
    console.error('[sandbox/pay] cobrança não encontrada:', body.correlationID, chargeRes.status);
    return Response.json({ error: 'cobrança não encontrada' }, { status: 404 });
  }
  const { charge } = (await chargeRes.json()) as {
    charge: { transactionID?: string; identifier?: string };
  };
  const transactionID = charge.transactionID ?? charge.identifier;
  if (!transactionID) {
    console.error('[sandbox/pay] cobrança sem transactionID:', body.correlationID);
    return Response.json({ error: 'cobrança sem transactionID' }, { status: 502 });
  }

  await fetch(`${SANDBOX_URL}/openpix/testing?transactionID=${encodeURIComponent(transactionID)}`, {
    headers: { Authorization: appId },
  });

  return Response.json({ ok: true });
}
