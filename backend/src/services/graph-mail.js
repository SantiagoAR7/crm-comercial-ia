export class GraphMailError extends Error {
  constructor(outcome, message) {
    super(message);
    this.outcome = outcome;
  }
}

export async function sendGraphMail({ mailbox, to, subject, text, attachments, reference }) {
  const { MICROSOFT_TENANT_ID: tenant, MICROSOFT_CLIENT_ID: client, MICROSOFT_CLIENT_SECRET: secret } = process.env;
  if (!tenant || !client || !secret || !mailbox) {
    throw new GraphMailError('failed', 'Correo no configurado.');
  }
  let accessToken;
  try {
    const response = await fetch('https://login.microsoftonline.com/' + encodeURIComponent(tenant) + '/oauth2/v2.0/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: client, client_secret: secret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error();
    accessToken = (await response.json()).access_token;
    if (!accessToken) throw new Error();
  } catch {
    throw new GraphMailError('failed', 'No se pudo autenticar el correo.');
  }

  let response;
  try {
    response = await fetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(mailbox) + '/sendMail', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json',
        ...(reference ? { 'client-request-id': reference, 'return-client-request-id': 'true' } : {}) },
      body: JSON.stringify({
        message: {
          subject, body: { contentType: 'Text', content: text }, toRecipients: [{ emailAddress: { address: to } }],
          ...(attachments?.length ? { attachments } : {}),
        },
        saveToSentItems: true,
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new GraphMailError('unknown', 'El resultado del envío quedó sin confirmar.');
  }
  if (response.status !== 202) {
    throw new GraphMailError(response.status >= 500 ? 'unknown' : 'failed', 'Microsoft rechazó o no confirmó el correo (' + response.status + ').');
  }
  return response.headers.get('request-id');
}
