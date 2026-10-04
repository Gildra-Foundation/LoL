import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LaneMap } from '@/components/champion/LaneMap';
import { AbilityDemo, LevelDemo } from '@/components/design/Demos';
import { Icon } from '@/components/Icon';
import { Button } from '@rift/engine/ui/Button';
import { Frame } from '@rift/engine/ui/Frame';
import { Keycap } from '@rift/engine/ui/Keycap';
import { PageHead } from '@rift/engine/ui/PageHead';
import { Radar } from '@rift/engine/ui/Radar';
import { ResourceBar } from '@rift/engine/ui/ResourceBar';
import { Tag } from '@rift/engine/ui/Tag';
import { langOf } from '@/lib/i18n';
import { CLASSES, CLASS_ORDER } from '@/lib/labels';
import styles from './page.module.css';

// внутренняя страница дизайн-системы — только на русском и не для поисковиков
export const metadata: Metadata = {
  title: 'Дизайн-система',
  description: 'Дизайн-система Rift Codex «HUD»: цвета, шрифты, компоненты, движение и правила текстов.',
  robots: { index: false },
};

const COLORS = [
  { name: 'Ночь Ущелья', token: '--night', hex: '#121A17', use: 'Фон страницы' },
  { name: 'Камень', token: '--stone', hex: '#222C28', use: 'Панели HUD, кнопки' },
  { name: 'Линия', token: '--line', hex: '#34403B', use: 'Границы и разделители' },
  { name: 'Кость', token: '--bone', hex: '#E9E4D6', use: 'Основной текст' },
  { name: 'Пепел', token: '--ash', hex: '#A9B3AC', use: 'Второстепенный текст' },
  { name: 'Здоровье', token: '--health', hex: '#4CC35E', use: 'Здоровье, рост, плюс' },
  { name: 'Союзник', token: '--ally', hex: '#3E9BFF', use: 'Выбор, ссылки, мана, синяя сторона' },
  { name: 'Враг', token: '--enemy', hex: '#E5484D', use: 'Минус, противник, красная сторона' },
  { name: 'Золото', token: '--gold', hex: '#E3B23C', use: 'Только первые места' },
];

const SCALE = [
  { size: 84, sample: 'Мордекайзер', font: 'display', weight: 800 },
  { size: 60, sample: 'Характеристики', font: 'display', weight: 800 },
  { size: 44, sample: 'Умения и образы', font: 'display', weight: 700 },
  { size: 32, sample: 'Где играют', font: 'display', weight: 700 },
  { size: 24, sample: 'Как растут характеристики', font: 'display', weight: 700 },
  { size: 18, sample: 'Текст статьи: 18 пикселей, межстрочный 1,7, строка не длиннее 70 знаков.', font: 'text', weight: 400 },
  { size: 16, sample: 'Текст интерфейса: подписи, описания умений, пояснения.', font: 'text', weight: 400 },
  { size: 14, sample: 'Вторичные подписи и метаданные.', font: 'text', weight: 400 },
  { size: 12, sample: 'Мелкие подписи осей и полей.', font: 'text', weight: 500 },
];

const MOTION = [
  { what: 'Загрузка HUD', how: 'Полоски здоровья и ресурса наполняются, умения «откатываются» по очереди', time: '900 мс, один раз на страницу' },
  { what: 'Выбор умения', how: 'Тёмный сектор перезарядки уходит по часовой стрелке', time: '620 мс, на каждое нажатие' },
  { what: 'Смена уровня', how: 'Изменившееся число коротко вспыхивает зелёным, полоски меняют длину', time: '600 мс / 420 мс' },
  { what: 'Переход к чемпиону', how: 'Портрет из сетки перелетает в HUD, страница сдвигается вглубь', time: '380 мс' },
  { what: 'Фильтры каталога', how: 'Карточки уходят, приходят и переставляются на новые места', time: 'по умолчанию браузера' },
];

export default async function DesignPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  if (lang !== 'ru') notFound();
  return (
    <div className="container">
      <PageHead title="Дизайн-система">
        Rift Codex устроен как интерфейс внутри матча. Каждый приём несёт игровой смысл: деления на полоске — сотни здоровья, клавиши — умения, синий —
        союзник, красный — враг.
      </PageHead>

      <section className={styles.block}>
        <h2>Принципы</h2>
        <ol className={styles.principles}>
          <li>
            <b>Интерфейс, а не украшение.</b> Ни одной линии, рамки или цвета без игрового смысла.
          </li>
          <li>
            <b>Одна громкая вещь на страницу.</b> На главной — экран выбора, у чемпиона — HUD, в сравнении — две полоски здоровья друг против друга.
          </li>
          <li>
            <b>Сначала клавиатура, как в игре.</b> P Q W E R, «+» и «−», стрелки и Enter, Ctrl+K — поиск.
          </li>
          <li>
            <b>Цифры говорят сами.</b> Короткие предложения, без лозунгов, обычный регистр, никаких подписей капсом.
          </li>
        </ol>
      </section>

      <section className={styles.block}>
        <h2>Цвет</h2>
        <p className={styles.lead}>Шесть рабочих цветов и золото для первых мест. Цвет всегда что-то значит.</p>
        <div className={styles.swatches}>
          {COLORS.map((c) => (
            <div key={c.token} className={styles.swatch}>
              <span className={styles.chip} style={{ background: `var(${c.token})` }} />
              <b>{c.name}</b>
              <code>
                {c.token} {c.hex}
              </code>
              <span>{c.use}</span>
            </div>
          ))}
        </div>
        <h3 className={styles.h3}>Классы</h3>
        <div className={styles.tags}>
          {CLASS_ORDER.map((t) => (
            <Tag key={t} icon={<Icon name={t} size={15} />} color={`var(--cls-${t})`}>
              {CLASSES.ru[t].label}
            </Tag>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2>Шрифты</h2>
        <p className={styles.lead}>
          Tektur — имена, заголовки и все числа: квадратная геометрия игрового интерфейса, ось ширины сжимает длинные имена. Geologica — текст и
          подписи, кириллица в ней родная.
        </p>
        <div className={styles.scale}>
          {SCALE.map((s) => (
            <div key={s.size} className={styles.scaleRow}>
              <span className={styles.scaleSize}>{s.size}</span>
              <span
                style={{
                  fontFamily: s.font === 'display' ? 'var(--font-display)' : 'var(--font-text)',
                  fontSize: s.size,
                  fontWeight: s.weight,
                  lineHeight: s.font === 'display' ? 1 : 1.5,
                  fontVariationSettings: s.size >= 60 ? "'wdth' 82" : undefined,
                }}
              >
                {s.sample}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2>Компоненты</h2>

        <div className={styles.components}>
          <Frame innerClassName={styles.demo}>
            <h3>Полоска ресурса</h3>
            <p className={styles.note}>Деление каждые 100 единиц, толстое — каждые 1000. Цвет по типу ресурса, как в игре.</p>
            <ResourceBar value={2358} label="Здоровье" caption="2 358 / 2 358" size="lg" />
            <ResourceBar value={418} tick={0} color="var(--res-mana)" label="Мана" caption="418 / 418" />
            <ResourceBar value={200} tick={0} color="var(--res-energy)" label="Энергия" caption="200 / 200" />
            <ResourceBar value={1523} scaleMax={1700} color="var(--enemy)" reverse label="Здоровье противника" caption="1 523" />
          </Frame>

          <Frame innerClassName={styles.demo}>
            <h3>Уровень</h3>
            <p className={styles.note}>Кнопки −/+, полоса опыта из 18 делений, ползунок для клавиатуры.</p>
            <LevelDemo />
          </Frame>

          <Frame innerClassName={styles.demo}>
            <h3>Ячейки умений</h3>
            <p className={styles.note}>Нажмите на ячейку или клавишу P, Q, W, E, R.</p>
            <AbilityDemo />
          </Frame>

          <Frame innerClassName={styles.demo}>
            <h3>Клавиши и кнопки</h3>
            <div className={styles.row}>
              <Keycap size="sm">Esc</Keycap>
              <Keycap>Ctrl</Keycap>
              <Keycap>K</Keycap>
              <Keycap size="lg">R</Keycap>
            </div>
            <div className={styles.row}>
              <Button variant="primary">Открыть страницу</Button>
              <Button>Сравнить</Button>
              <Button variant="ghost">Сбросить</Button>
              <Button variant="primary" size="sm">
                Маленькая
              </Button>
            </div>
          </Frame>

          <div className={styles.frames}>
            <Frame innerClassName={styles.demo}>
              <h3>Рамка</h3>
              <p className={styles.note}>Срезанные углы — левый верхний и правый нижний.</p>
            </Frame>
            <Frame tone="ally" innerClassName={styles.demo}>
              <h3>Союзник</h3>
              <p className={styles.note}>Советы, синяя сторона.</p>
            </Frame>
            <Frame tone="enemy" innerClassName={styles.demo}>
              <h3>Враг</h3>
              <p className={styles.note}>Против кого играете, красная сторона.</p>
            </Frame>
          </div>

          <Frame innerClassName={styles.demo}>
            <h3>Мини-карта и радар</h3>
            <div className={styles.split}>
              <LaneMap positions={['MIDDLE', 'BOTTOM']} />
              <Radar
                axes={['Урон', 'Живучесть', 'Контроль', 'Мобильность', 'Полезность']}
                series={[
                  { label: 'Ари', color: 'var(--ally)', values: [3, 1, 2, 3, 1] },
                  { label: 'Зед', color: 'var(--enemy)', values: [3, 1, 1, 3, 1] },
                ]}
              />
            </div>
          </Frame>
        </div>
      </section>

      <section className={styles.block}>
        <h2>Движение</h2>
        <p className={styles.lead}>
          Без анимаций «просто так». Движение отвечает на действие или показывает связь. Всё отключается при «уменьшить движение» в системе.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Момент</th>
              <th scope="col">Что происходит</th>
              <th scope="col">Длительность</th>
            </tr>
          </thead>
          <tbody>
            {MOTION.map((m) => (
              <tr key={m.what}>
                <th scope="row">{m.what}</th>
                <td>{m.how}</td>
                <td>{m.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.block}>
        <h2>Текст</h2>
        <ul className={styles.rules}>
          <li>Пишем как игрок игроку: «сила атаки», «перезарядка», «на 18 уровне». Сленг — только если он понятнее.</li>
          <li>Кнопка говорит, что случится: «Открыть страницу», «Сравнить», «Сбросить фильтры».</li>
          <li>Обычный регистр везде. Никаких подписей капсом и точек-разделителей «A · B · C».</li>
          <li>Пустой результат подсказывает, что делать: «Уберите фильтр класса или проверьте имя».</li>
          <li>Числа — в формате ru-RU: 2 358, 0,668, +3,65%.</li>
        </ul>
      </section>
    </div>
  );
}
