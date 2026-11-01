// Отправка писем: EMAIL_TRANSPORT=smtp|capture|disabled (как в прежнем CMS).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { authOrigin } from './config';

export type EmailMode = 'smtp' | 'capture' | 'disabled';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface CapturedEmail extends OutgoingEmail {
  at: string;
}

/**
 * - `smtp` — EMAIL_TRANSPORT=smtp, SMTP_HOST и EMAIL_FROM_ADDRESS заданы;
 * - `capture` — EMAIL_TRANSPORT=capture: письма остаются в памяти процесса (и в EMAIL_CAPTURE_DIR, если задан) для тестов.
 *   На боевом адресе riftden.com и в production без EMAIL_CAPTURE_DIR не включается;
 * - `disabled` — всё остальное: отправка отклоняется, а в журнал не пишется ни адрес, ни ссылка.
 */
export function emailMode(): EmailMode {
  const transport = process.env.EMAIL_TRANSPORT;
  if (transport === 'smtp' && process.env.SMTP_HOST && process.env.EMAIL_FROM_ADDRESS) return 'smtp';
  if (transport === 'capture' && authOrigin() !== 'https://riftden.com' && (process.env.NODE_ENV !== 'production' || process.env.EMAIL_CAPTURE_DIR)) return 'capture';
  return 'disabled';
}

const store = globalThis as typeof globalThis & { __riftdenMail?: CapturedEmail[]; __riftdenSmtp?: Transporter };

export const capturedEmails = (): CapturedEmail[] => (store.__riftdenMail ??= []);
export const clearCapturedEmails = () => {
  store.__riftdenMail = [];
};

export class EmailUnavailableError extends Error {
  constructor() {
    super('Email delivery is not configured');
  }
}

function smtp(): Transporter {
  if (store.__riftdenSmtp) return store.__riftdenSmtp;
  const port = Number(process.env.SMTP_PORT || 587);
  store.__riftdenSmtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    // на 587 только STARTTLS: пароль SASL не уходит открытым текстом
    requireTLS: port !== 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
    // host.docker.internal не совпадает с именем в сертификате почтового сервера — имя для проверки задаётся отдельно
    tls: process.env.SMTP_TLS_SERVERNAME ? { servername: process.env.SMTP_TLS_SERVERNAME } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return store.__riftdenSmtp;
}

export async function sendEmail(message: OutgoingEmail): Promise<void> {
  const mode = emailMode();
  if (mode === 'capture') {
    const captured = { ...message, at: new Date().toISOString() };
    capturedEmails().push(captured);
    const dir = process.env.EMAIL_CAPTURE_DIR;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
      writeFileSync(path.join(dir, name), JSON.stringify(captured));
    }
    return;
  }
  if (mode === 'disabled') {
    console.warn(JSON.stringify({ type: 'riftden_mail', status: 'refused', reason: 'not-configured' }));
    throw new EmailUnavailableError();
  }
  const name = process.env.EMAIL_FROM_NAME || 'RiftDen';
  await smtp().sendMail({ from: { name, address: process.env.EMAIL_FROM_ADDRESS! }, to: message.to, subject: message.subject, text: message.text, html: message.html });
}
