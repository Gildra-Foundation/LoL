// Письма аккаунта на языке посетителя: подтверждение почты и сброс пароля. Чистые функции — проверяются тестами.
import { DEFAULT_LOCALE, defineMessages, localePath, stripLocale, type Locale } from '@/lib/i18n';

export type MailKind = 'verify' | 'reset';

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

const TEXT = defineMessages({
  ru: {
    verify: {
      subject: 'RiftDen: подтвердите почту',
      lead: 'Вы зарегистрировались на RiftDen. Чтобы войти, подтвердите адрес почты.',
      action: 'Подтвердить почту',
      expires: 'Ссылка действует 24 часа.',
    },
    reset: {
      subject: 'RiftDen: сброс пароля',
      lead: 'Кто-то запросил сброс пароля для вашего аккаунта RiftDen.',
      action: 'Задать новый пароль',
      expires: 'Ссылка действует 1 час.',
    },
    ignore: 'Если это были не вы, просто не открывайте ссылку — с аккаунтом ничего не случится.',
    fallback: 'Если кнопка не открывается, скопируйте адрес в браузер:',
    footer: 'Письмо отправлено автоматически, отвечать на него не нужно.',
  },
  en: {
    verify: {
      subject: 'RiftDen: confirm your email',
      lead: 'You signed up for RiftDen. Confirm your email address to sign in.',
      action: 'Confirm email',
      expires: 'The link is valid for 24 hours.',
    },
    reset: {
      subject: 'RiftDen: reset your password',
      lead: 'Someone asked to reset the password of your RiftDen account.',
      action: 'Set a new password',
      expires: 'The link is valid for 1 hour.',
    },
    ignore: 'If it was not you, just ignore this email — nothing will change.',
    fallback: 'If the button does not open, copy this address into your browser:',
    footer: 'This email was sent automatically, there is no need to reply.',
  },
});

const PAGE: Record<MailKind, string> = { verify: '/account/verify', reset: '/account/reset' };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Язык письма — по странице, с которой пришёл запрос: Better Auth кладёт её в callbackURL своей ссылки
 * (/en/account → английский, /account → русский).
 */
export function mailLocale(betterAuthUrl: string): Locale {
  try {
    const callback = new URL(betterAuthUrl).searchParams.get('callbackURL');
    return callback ? stripLocale(new URL(callback, 'http://x').pathname).locale : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Ссылка ведёт на страницу сайта, а не прямо в /api/auth: токен тратится только по нажатию кнопки на странице,
 * и почтовые сканеры, открывающие ссылки заранее, не подтверждают и не сбрасывают ничего за человека.
 */
export function mailLink(kind: MailKind, origin: string, locale: Locale, token: string): string {
  return `${origin}${localePath(locale, PAGE[kind])}?token=${encodeURIComponent(token)}`;
}

export function renderMail(kind: MailKind, locale: Locale, link: string): MailContent {
  const t = TEXT[locale];
  const m = t[kind];
  const href = escapeHtml(link);
  const text = [m.lead, '', `${m.action}: ${link}`, '', m.expires, t.ignore, '', '— RiftDen', t.footer].join('\n');
  const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(m.subject)}</title></head>
<body style="margin:0;padding:24px;background:#121a17;color:#e9e4d6;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#1a2420;border:1px solid #33403a">
<tr><td style="padding:28px 28px 8px;font-size:22px;font-weight:bold;letter-spacing:.02em">RiftDen</td></tr>
<tr><td style="padding:8px 28px">${escapeHtml(m.lead)}</td></tr>
<tr><td style="padding:16px 28px"><a href="${href}" style="display:inline-block;padding:12px 20px;background:#e9e4d6;color:#121a17;font-weight:bold;text-decoration:none">${escapeHtml(m.action)}</a></td></tr>
<tr><td style="padding:8px 28px;color:#a9b3ad;font-size:14px">${escapeHtml(m.expires)} ${escapeHtml(t.ignore)}</td></tr>
<tr><td style="padding:8px 28px;color:#a9b3ad;font-size:13px">${escapeHtml(t.fallback)}<br><a href="${href}" style="color:#3e9bff;word-break:break-all">${href}</a></td></tr>
<tr><td style="padding:16px 28px 28px;color:#7d8983;font-size:12px">${escapeHtml(t.footer)}</td></tr>
</table></body></html>`;
  return { subject: m.subject, text, html };
}
