import type { Metadata } from 'next';
import Link from '@rift/engine/i18n/Link';
import { PageHead } from '@rift/engine/ui/PageHead';
import { formatDate } from '@rift/engine/lib/format';
import { UPDATED_AT } from '@/lib/champions';
import { DATA_VERSION } from '@/lib/assets';
import { alternates, defineMessages, langOf } from '@/lib/i18n';
import styles from '../prose.module.css';
const MESSAGES = defineMessages({
  ru: { title: 'Данные и методика расчётов', description: 'Источники данных RiftDen, формулы характеристик и ограничения сравнения чемпионов, дуэлей и билдов.',
    updated: 'Данные обновлены', patch: 'Патч', sources: 'Источники',
    sourceText: 'Data Dragon предоставляет характеристики, умения и предметы. CommunityDragon дополняет игровые коэффициенты, видео и сведения об образах. Meraki Analytics используется для основных позиций. Истории и регионы взяты из Universe Riot.',
    stats: 'Рост характеристик', statsText: 'Для уровня n используем базовое значение плюс прирост, умноженный на (n − 1) × (0,7025 + 0,0175 × (n − 1)). На 1 уровне добавка равна нулю, на 18 — семнадцати приростам. Скорость атаки использует отдельный коэффициент, если он известен.',
    limits: 'Как читать результаты', limitsText: 'Базовый DPS автоатак — сила атаки × скорость атаки. Рейтинг не учитывает умения, пассивные эффекты, предметы, критические удары и решения игрока. Эффективное здоровье показывает расчётную стойкость к одному типу урона без пробивания и щитов.',
    duelText: 'Дуэль моделирует автоатаки, броню и восстановление здоровья; сближение учитывается выбранной настройкой. Умения, руны, предметы и критические удары исключены. Победа в модели не является прогнозом победы на линии.',
    buildText: 'Конструктор складывает базовые характеристики, известные характеристики предметов и поддерживаемые эффекты осколков. Ситуативные пассивные эффекты и полный бой не моделируются. Пользовательский тир-лист отражает собственную расстановку, а не статистику побед.',
    links: 'Проверить на практике', compare: 'Сравнение', builds: 'Конструктор билдов', tier: 'Создать свой тир-лист' },
  en: { title: 'Data and calculation methods', description: 'RiftDen data sources, stat formulas and limitations of champion comparisons, duels and builds.',
    updated: 'Data updated', patch: 'Patch', sources: 'Sources',
    sourceText: 'Data Dragon supplies champion stats, abilities and items. CommunityDragon adds game coefficients, videos and skin details. Meraki Analytics supplies primary positions. Stories and regions come from Riot Universe.',
    stats: 'Stat growth', statsText: 'At level n we use the base value plus growth multiplied by (n − 1) × (0.7025 + 0.0175 × (n − 1)). The bonus is zero at level 1 and seventeen growth increments at level 18. Attack speed uses its separate ratio when available.',
    limits: 'Interpreting results', limitsText: 'Base auto-attack DPS is attack damage × attack speed. Rankings exclude abilities, passives, items, critical strikes and player decisions. Effective health estimates durability against one damage type without penetration or shields.',
    duelText: 'Duels simulate auto attacks, armor and health regeneration; closing distance follows the selected setting. Abilities, runes, items and critical strikes are excluded. Winning the simulation does not predict winning a lane.',
    buildText: 'The editor combines base stats, known item stats and supported shard effects. Conditional passives and complete combat are not simulated. A personal tier list represents your own rankings rather than win-rate data.',
    links: 'Explore the tools', compare: 'Compare', builds: 'Build editor', tier: 'Make your own tier list' },
});
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langOf(params); const t = MESSAGES[lang];
  return { title: t.title, description: t.description, alternates: alternates(lang, '/methodology') };
}
export default async function Methodology({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params); const t = MESSAGES[lang];
  return <div className={`container ${styles.prose}`}>
    <PageHead title={t.title}>{t.description}</PageHead>
    <div className={styles.body}>
    <p className={styles.meta}>{t.patch} {DATA_VERSION}. {t.updated}: <time dateTime={UPDATED_AT.toISOString()}>{formatDate(UPDATED_AT, lang)}</time></p>
    <section><h2>{t.sources}</h2><p>{t.sourceText}</p><ul>
      <li><a href="https://developer.riotgames.com/docs/lol#data-dragon">Riot Data Dragon</a></li>
      <li><a href="https://www.communitydragon.org/">CommunityDragon</a></li>
      <li><a href="https://github.com/meraki-analytics/lolstaticdata">Meraki Analytics</a></li>
      <li><a href="https://universe.leagueoflegends.com/">Riot Universe</a></li>
    </ul></section>
    <section><h2>{t.stats}</h2><p>{t.statsText}</p></section>
    <section><h2>{t.limits}</h2><p>{t.limitsText}</p><p>{t.duelText}</p><p>{t.buildText}</p></section>
    <section><h2>{t.links}</h2><ul><li><Link href="/compare">{t.compare}</Link></li><li><Link href="/builds">{t.builds}</Link></li><li><Link href="/tier-list">{t.tier}</Link></li></ul></section>
    </div>
  </div>;
}
