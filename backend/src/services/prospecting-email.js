import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';
import { supabase } from './supabase.js';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const stateFile = process.env.PROSPECTING_EMAIL_STATE_FILE || path.join(dataDir, 'prospecting-email-state.json');

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function emailConfig() {
  const fromAddress = clean(process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'transformaciondigital@davofrio.com').toLowerCase();
  return {
    enabled: bool(process.env.PROSPECTING_EMAIL_ENABLED, false),
    pollEnabled: bool(process.env.PROSPECTING_EMAIL_POLL_ENABLED, false),
    processBacklog: bool(process.env.PROSPECTING_EMAIL_PROCESS_BACKLOG, false),
    pollIntervalSeconds: Math.max(30, number(process.env.EMAIL_POLL_INTERVAL_SECONDS, 90)),
    fromName: clean(process.env.EMAIL_FROM_NAME || 'DAVOFRIO'),
    fromAddress,
    smtp: {
      host: clean(process.env.SMTP_HOST || 'smtp.office365.com'),
      port: number(process.env.SMTP_PORT, 587),
      secure: bool(process.env.SMTP_SECURE, false),
      user: clean(process.env.SMTP_USER || fromAddress),
      pass: clean(process.env.SMTP_PASS || ''),
    },
    imap: {
      host: clean(process.env.IMAP_HOST || 'outlook.office365.com'),
      port: number(process.env.IMAP_PORT, 993),
      secure: bool(process.env.IMAP_SECURE, true),
      user: clean(process.env.IMAP_USER || fromAddress),
      pass: clean(process.env.IMAP_PASS || process.env.SMTP_PASS || ''),
    },
  };
}

export function emailStatus() {
  const config = emailConfig();
  return {
    enabled: config.enabled,
    pollEnabled: config.pollEnabled,
    fromAddress: config.fromAddress,
    smtpConfigured: Boolean(config.smtp.host && config.smtp.user && config.smtp.pass),
    imapConfigured: Boolean(config.imap.host && config.imap.user && config.imap.pass),
    pollIntervalSeconds: config.pollIntervalSeconds,
  };
}

function base64(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function escapeHeader(value) {
  return clean(value).replace(/[\r\n]+/g, ' ');
}

function formatAddress(name, address) {
  const cleanAddress = clean(address).toLowerCase();
  const cleanName = escapeHeader(name);
  return cleanName ? `"${cleanName.replace(/"/g, '\\"')}" <${cleanAddress}>` : cleanAddress;
}

function normalizeNewlines(value) {
  return String(value || '').replace(/\r?\n/g, '\r\n');
}

function buildMessage({ fromName, fromAddress, to, subject, body, messageId, prospectId, listId, trackingToken }) {
  const encodedSubject = escapeHeader(subject);
  const headers = [
    `From: ${formatAddress(fromName, fromAddress)}`,
    `To: ${clean(to).toLowerCase()}`,
    `Subject: ${encodedSubject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    `X-Davofrio-Prospect-Id: ${prospectId}`,
    listId ? `X-Davofrio-List-Id: ${listId}` : '',
    `X-Davofrio-Tracking-Token: ${trackingToken}`,
  ].filter(Boolean);

  return `${headers.join('\r\n')}\r\n\r\n${normalizeNewlines(body)}\r\n`;
}

function createLineClient(socket) {
  let buffer = '';
  const waiters = [];

  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      const waiter = waiters[index];
      if (waiter.done(buffer)) {
        waiters.splice(index, 1);
        const output = buffer;
        buffer = '';
        waiter.resolve(output);
      }
    }
  });
  socket.on('error', (error) => {
    while (waiters.length) waiters.pop().reject(error);
  });

  return {
    socket,
    readUntil(done, timeoutMs = 30000) {
      if (done(buffer)) {
        const output = buffer;
        buffer = '';
        return Promise.resolve(output);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error('Timeout esperando respuesta del servidor de correo.'));
        }, timeoutMs);
        const waiter = {
          done,
          resolve(value) {
            clearTimeout(timer);
            resolve(value);
          },
          reject(error) {
            clearTimeout(timer);
            reject(error);
          },
        };
        waiters.push(waiter);
      });
    },
    write(value) {
      socket.write(value);
    },
    close() {
      socket.end();
    },
  };
}

async function smtpCommand(client, command, expected = /^[23]/) {
  if (command) client.write(`${command}\r\n`);
  const response = await client.readUntil((text) => /\r?\n\d{3} /.test(text));
  const lines = response.trim().split(/\r?\n/);
  const last = lines[lines.length - 1] || '';
  if (!expected.test(last)) throw new Error(`SMTP rechazo comando: ${last}`);
  return response;
}

async function connectSmtp(config) {
  const rawSocket = config.secure
    ? tls.connect({ host: config.host, port: config.port, servername: config.host })
    : net.connect({ host: config.host, port: config.port });
  let client = createLineClient(rawSocket);
  await smtpCommand(client, null);
  await smtpCommand(client, `EHLO ${process.env.SMTP_EHLO_NAME || 'crm.iadavofrio.com'}`);

  if (!config.secure) {
    await smtpCommand(client, 'STARTTLS', /^220/);
    const secureSocket = tls.connect({ socket: rawSocket, servername: config.host });
    client = createLineClient(secureSocket);
    await smtpCommand(client, `EHLO ${process.env.SMTP_EHLO_NAME || 'crm.iadavofrio.com'}`);
  }

  await smtpCommand(client, 'AUTH LOGIN', /^334/);
  await smtpCommand(client, base64(config.user), /^334/);
  await smtpCommand(client, base64(config.pass), /^235/);
  return client;
}

export async function sendProspectingEmail({ prospect, message, subject, body, to }) {
  const config = emailConfig();
  if (!config.enabled) throw new Error('El envio de emails de prospeccion esta desactivado.');
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    throw new Error('Faltan credenciales SMTP para enviar emails.');
  }

  const trackingToken = `DVF-${message.id.slice(0, 8)}`;
  const cleanSubject = escapeHeader(subject || message.subject || `${prospect.company_name} | DAVOFRIO`);
  const trackedSubject = cleanSubject.includes(`[${trackingToken}]`) ? cleanSubject : `${cleanSubject} [${trackingToken}]`;
  const messageId = `<${trackingToken.toLowerCase()}-${randomUUID()}@iadavofrio.com>`;
  const recipient = clean(to || prospect.email).toLowerCase();
  if (!recipient) throw new Error('El prospecto no tiene email destino.');

  const rawMessage = buildMessage({
    fromName: config.fromName,
    fromAddress: config.fromAddress,
    to: recipient,
    subject: trackedSubject,
    body: body || message.body,
    messageId,
    prospectId: prospect.id,
    listId: prospect.list_id,
    trackingToken,
  });

  const client = await connectSmtp(config.smtp);
  try {
    await smtpCommand(client, `MAIL FROM:<${config.fromAddress}>`);
    await smtpCommand(client, `RCPT TO:<${recipient}>`);
    await smtpCommand(client, 'DATA', /^354/);
    client.write(`${rawMessage.replace(/\r\n\./g, '\r\n..')}\r\n.\r\n`);
    await smtpCommand(client, null);
    await smtpCommand(client, 'QUIT', /^221/);
  } finally {
    client.close();
  }

  return {
    to: recipient,
    from: config.fromAddress,
    subject: trackedSubject,
    body: body || message.body,
    messageId,
    trackingToken,
  };
}

async function readState() {
  try {
    return JSON.parse(await fs.readFile(stateFile, 'utf8'));
  } catch {
    return {};
  }
}

async function writeState(state) {
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
}

function imapQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function connectImap(config) {
  const socket = config.secure
    ? tls.connect({ host: config.host, port: config.port, servername: config.host })
    : net.connect({ host: config.host, port: config.port });
  const client = createLineClient(socket);
  await client.readUntil((text) => /\* OK/.test(text));
  return client;
}

let imapTag = 0;
async function imapCommand(client, command, timeoutMs = 45000) {
  imapTag += 1;
  const tag = `A${String(imapTag).padStart(4, '0')}`;
  client.write(`${tag} ${command}\r\n`);
  const response = await client.readUntil((text) => new RegExp(`${tag} (OK|NO|BAD)`, 'i').test(text), timeoutMs);
  if (new RegExp(`${tag} (NO|BAD)`, 'i').test(response)) {
    throw new Error(`IMAP rechazo comando ${command}: ${response.split(/\r?\n/).slice(-2).join(' ')}`);
  }
  return response;
}

function parseUidNext(selectResponse) {
  const match = selectResponse.match(/\[UIDNEXT\s+(\d+)]/i);
  return match ? Number(match[1]) : 1;
}

function parseSearchUids(response) {
  const line = response.split(/\r?\n/).find((item) => item.startsWith('* SEARCH')) || '';
  return line.replace('* SEARCH', '').trim().split(/\s+/).map(Number).filter(Boolean);
}

function unfoldHeaders(rawHeaders) {
  return rawHeaders.replace(/\r?\n[ \t]+/g, ' ');
}

function decodeMimeWords(value) {
  return String(value || '').replace(/=\?([^?]+)\?([bq])\?([^?]+)\?=/gi, (_all, charset, encoding, text) => {
    try {
      const buffer = encoding.toLowerCase() === 'b'
        ? Buffer.from(text, 'base64')
        : Buffer.from(text.replace(/_/g, ' ').replace(/=([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))), 'binary');
      return buffer.toString(charset.toLowerCase().includes('iso-8859-1') ? 'latin1' : 'utf8');
    } catch {
      return text;
    }
  });
}

function parseEmail(raw) {
  const [headerPart, ...bodyParts] = raw.split(/\r?\n\r?\n/);
  const headers = {};
  for (const line of unfoldHeaders(headerPart).split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    headers[key] = headers[key] ? `${headers[key]} ${value}` : value;
  }
  const body = bodyParts.join('\n\n').trim();
  const fromHeader = decodeMimeWords(headers.from || '');
  const fromMatch = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<>@]+@[^\s<>@]+)/);
  return {
    headers,
    from: clean(fromMatch?.[1] || '').toLowerCase(),
    subject: decodeMimeWords(headers.subject || ''),
    body,
  };
}

function extractRawEmail(fetchResponse) {
  const literal = fetchResponse.match(/\{(\d+)}\r?\n/);
  if (!literal) return '';
  const start = literal.index + literal[0].length;
  const length = Number(literal[1]);
  return fetchResponse.slice(start, start + length);
}

function extractTrackingToken(email) {
  const haystack = [
    email.subject,
    email.headers['x-davofrio-tracking-token'],
    email.headers['in-reply-to'],
    email.headers.references,
  ].filter(Boolean).join(' ');
  const match = haystack.match(/DVF-[a-f0-9]{8}/i) || haystack.match(/dvf-[a-f0-9]{8}/i);
  return match ? match[0].toUpperCase() : '';
}

async function findOutboundByToken(trackingToken) {
  const { data, error } = await supabase
    .from('prospect_activities')
    .select('id, prospect_id, metadata, created_at')
    .eq('type', 'MENSAJE')
    .contains('metadata', { trackingToken })
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function recordInboundEmail({ uid, email, trackingToken, outbound }) {
  const metadata = outbound.metadata || {};
  const prospectId = outbound.prospect_id;
  const messageId = typeof metadata.messageId === 'string' ? metadata.messageId : null;

  await supabase.from('prospect_activities').insert({
    prospect_id: prospectId,
    type: 'NOTA',
    description: `Respuesta recibida por email: ${email.subject || 'Sin asunto'}.`,
    metadata: {
      emailDirection: 'inbound',
      imapUid: uid,
      from: email.from,
      subject: email.subject,
      body: email.body.slice(0, 12000),
      trackingToken,
      outreachStatus: 'RESPONDIDO',
      matchedOutboundActivityId: outbound.id,
      messageId,
    },
  });

  if (messageId) {
    await supabase
      .from('prospect_messages')
      .update({ status: 'RESPONDIDO' })
      .eq('id', messageId);
  }
}

export async function pollProspectingInbox() {
  const config = emailConfig();
  if (!config.enabled || !config.pollEnabled) return { processed: 0, skipped: 0, disabled: true };
  if (!config.imap.host || !config.imap.user || !config.imap.pass) {
    throw new Error('Faltan credenciales IMAP para leer respuestas.');
  }

  const state = await readState();
  const client = await connectImap(config.imap);
  let processed = 0;
  let skipped = 0;
  let lastUid = Number(state.lastUid || 0);

  try {
    await imapCommand(client, `LOGIN ${imapQuote(config.imap.user)} ${imapQuote(config.imap.pass)}`);
    const selected = await imapCommand(client, 'SELECT INBOX');
    const uidNext = parseUidNext(selected);

    if (!lastUid && !config.processBacklog) {
      lastUid = Math.max(0, uidNext - 1);
      await writeState({ ...state, lastUid, initializedAt: new Date().toISOString() });
      return { processed: 0, skipped: 0, initialized: true };
    }

    const fromUid = Math.max(1, lastUid + 1);
    const search = await imapCommand(client, `UID SEARCH UID ${fromUid}:*`);
    const uids = parseSearchUids(search).slice(0, 25);

    for (const uid of uids) {
      const response = await imapCommand(client, `UID FETCH ${uid} (BODY.PEEK[])`);
      const raw = extractRawEmail(response);
      if (!raw) {
        skipped += 1;
        lastUid = Math.max(lastUid, uid);
        continue;
      }

      const email = parseEmail(raw);
      const trackingToken = extractTrackingToken(email);
      if (!trackingToken) {
        skipped += 1;
        lastUid = Math.max(lastUid, uid);
        continue;
      }

      const outbound = await findOutboundByToken(trackingToken);
      if (!outbound) {
        skipped += 1;
        lastUid = Math.max(lastUid, uid);
        continue;
      }

      await recordInboundEmail({ uid, email, trackingToken, outbound });
      processed += 1;
      lastUid = Math.max(lastUid, uid);
    }

    await writeState({ ...state, lastUid, checkedAt: new Date().toISOString() });
    return { processed, skipped, lastUid };
  } finally {
    try {
      await imapCommand(client, 'LOGOUT', 10000);
    } catch {
      client.close();
    }
  }
}

let workerStarted = false;
export function startProspectingEmailWorker() {
  const config = emailConfig();
  if (workerStarted || !config.enabled || !config.pollEnabled) return;
  workerStarted = true;

  const run = async () => {
    try {
      const result = await pollProspectingInbox();
      if (result.processed) console.log(`Prospecting email replies processed: ${result.processed}`);
    } catch (error) {
      console.error('Prospecting email poll failed:', error instanceof Error ? error.message : error);
    }
  };

  setTimeout(run, 5000);
  setInterval(run, config.pollIntervalSeconds * 1000);
}
