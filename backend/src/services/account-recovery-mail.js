import { sendGraphMail } from './graph-mail.js';

export async function sendRecoveryMail({ to, subject, text }) {
  const mailbox = process.env.MICROSOFT_MAILBOX || process.env.EMAIL_FROM_ADDRESS;
  await sendGraphMail({ mailbox, to, subject, text });
}
