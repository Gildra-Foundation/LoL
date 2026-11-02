import type { Metadata } from 'next';
import Link from '@rift/engine/i18n/Link';
import { PageHead } from '@rift/engine/ui/PageHead';
import { alternates, defineMessages, langOf } from '@/lib/i18n';
import styles from '../prose.module.css';

const SUPPORT = 'support@riftden.com';

const TEXT = defineMessages({
  ru: {
    title: 'Данные и приватность',
    description: 'Какие данные RiftDen хранит об аккаунте, зачем, как долго и как удалить аккаунт.',
    sections: [
      ['Без аккаунта', 'Справочником можно пользоваться без регистрации. Мы считаем посещения через Plausible — без cookie и без сведений, по которым можно узнать человека. Ваш выбор в инструментах (билды, тир-листы) хранится только в вашем браузере.'],
      ['Что хранится в аккаунте', 'Адрес почты, пароль в виде хэша scrypt (сам пароль мы не знаем и не храним), дата регистрации и подтверждения почты, список избранного. Для каждого входа — сессия с датой, адресом IP и названием браузера: так можно увидеть вход с чужого устройства и выйти везде.'],
      ['Cookie', 'После входа сайт ставит одну служебную cookie сессии (httpOnly, Secure, SameSite=Lax) на 30 дней. Рекламных и сторонних cookie нет.'],
      ['Письма', 'Мы пишем только по делу: ссылка для подтверждения почты и ссылка для сброса пароля. Рассылок нет.'],
      ['Защита от перебора', 'Чтобы защитить вход от подбора пароля, сервер считает попытки по адресу IP; счётчики удаляются через сутки. Форма регистрации может показать проверку Cloudflare Turnstile.'],
      ['Где хранится', 'Данные хранятся в базе на сервере сайта; трафик идёт через Cloudflare. Резервные копии базы делаются раз в сутки и хранятся 14 дней. Данные никому не передаются и не продаются.'],
      ['Удаление', 'Аккаунт удаляется в настройках: вместе с ним сразу удаляются избранное и все сессии. Из резервных копий данные исчезают не позже чем через 14 дней.'],
    ] as [string, string][],
    settings: 'Открыть настройки аккаунта',
    contact: 'Вопросы о данных:',
  },
  en: {
    title: 'Data and privacy',
    description: 'What RiftDen stores about an account, why, for how long and how to delete it.',
    sections: [
      ['Without an account', 'You can use the reference without signing up. Visits are counted with Plausible — no cookies and nothing that identifies a person. Your choices in the tools (builds, tier lists) stay in your browser only.'],
      ['What an account stores', 'Your email address, the password as a scrypt hash (we never see or store the password itself), the dates of sign-up and email confirmation, and your favorites. For every sign-in there is a session with its date, IP address and browser name, so a sign-in from someone else’s device can be spotted and ended.'],
      ['Cookies', 'After you sign in the site sets one session cookie (httpOnly, Secure, SameSite=Lax) for 30 days. There are no advertising or third-party cookies.'],
      ['Emails', 'We only send what you ask for: an email confirmation link and a password reset link. No newsletters.'],
      ['Abuse protection', 'To protect sign-in from password guessing the server counts attempts per IP address; the counters are deleted after a day. The sign-up form may show a Cloudflare Turnstile check.'],
      ['Where it is stored', 'Data lives in a database on the site’s own server; traffic goes through Cloudflare. Database backups are made daily and kept for 14 days. Data is never shared or sold.'],
      ['Deletion', 'Delete the account in the settings: favorites and all sessions are deleted with it at once. Backups lose the data within 14 days.'],
    ] as [string, string][],
    settings: 'Open account settings',
    contact: 'Questions about your data:',
  },
});

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langOf(params);
  return { title: TEXT[lang].title, description: TEXT[lang].description, alternates: alternates(lang, '/privacy') };
}

export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  const t = TEXT[await langOf(params)];
  return (
    <div className={`container ${styles.prose}`}>
      <PageHead title={t.title}>{t.description}</PageHead>
      <div className={styles.body}>
        {t.sections.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <div className={styles.footer}>
          <p>
            <Link href="/account/settings">{t.settings}</Link>
          </p>
          <p>
            {t.contact} <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
