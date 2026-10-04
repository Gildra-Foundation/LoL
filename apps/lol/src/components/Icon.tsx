// Иконки League of Legends: классы, линии на мини-карте, характеристики. Интерфейсные иконки приходят из движка.
import { createIcon } from '@rift/engine/ui/Icon';

const frame = '<rect x="3.5" y="3.5" width="17" height="17" rx="2" opacity=".32"/>';
const heart = 'M12 20s-7.5-4.4-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.6-7.5 10-7.5 10Z';
const shield = 'M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6Z';
const sword = '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/>';
const drop = 'M12 3s-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-6-11-6-11Z';

export const LOL_ICONS = {
  // классы
  Fighter: sword,
  Tank: `<path d="${shield}"/>`,
  Mage: '<path d="M10 4c.5 4 2.8 6.5 7 7-4.2.5-6.5 3-7 7-.5-4-2.8-6.5-7-7 4.2-.5 6.5-3 7-7Z"/><path d="M18.5 2.5v4M16.5 4.5h4"/>',
  Assassin: '<path d="M12 2.5 14.5 6v8h-5V6Z"/><path d="M7 14h10"/><path d="M12 14v5"/><circle cx="12" cy="20.5" r="1.5"/>',
  Support: `<path d="${heart}"/>`,
  Marksman: '<circle cx="12" cy="12" r="7.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  // позиции
  TOP: `${frame}<path d="M3.5 16V5.5a2 2 0 0 1 2-2H16" stroke-width="2.6"/>`,
  JUNGLE: `${frame}<path d="M8 16c0-4.5 3-8 8.5-8.5C16 13 12.5 16 8 16Z"/><path d="m8 16 4.5-4.5"/>`,
  MIDDLE: `${frame}<path d="M7 17 17 7" stroke-width="2.6"/>`,
  BOTTOM: `${frame}<path d="M8 20.5h10.5a2 2 0 0 0 2-2V8" stroke-width="2.6"/>`,
  SUPPORT: `${frame}<path d="M12 8v8M8 12h8" stroke-width="2.4"/>`,
  // характеристики
  hp: `<path d="${heart}"/>`,
  hpregen: `<path d="${heart}"/><path d="M12 10v5M9.5 12.5h5"/>`,
  mp: `<path d="${drop}"/>`,
  mpregen: `<path d="${drop}"/><path d="M12 11.5v5M9.5 14h5"/>`,
  ad: sword,
  as: '<path d="m5 6 6 6-6 6M13 6l6 6-6 6"/>',
  armor: `<path d="${shield}"/>`,
  mr: `<path d="${shield}"/><path d="M12 8.5c.3 2 1.3 3 3.2 3.3-1.9.3-2.9 1.3-3.2 3.3-.3-2-1.3-3-3.2-3.3 1.9-.3 2.9-1.3 3.2-3.3Z"/>`,
  ms: '<path d="M3 12h15"/><path d="m13 6 6 6-6 6"/><path d="M3 7.5h5M3 16.5h5"/>',
  range: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  ehp: `<path d="${shield}"/><path d="M12 15.5s-3.2-1.9-3.2-4.3A1.9 1.9 0 0 1 12 9.9a1.9 1.9 0 0 1 3.2 1.3c0 2.4-3.2 4.3-3.2 4.3Z"/>`,
  dps: '<path d="M12 3c1 3.5 5.5 5.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.6 1.4-4.3 2.6-5.6.3 1.6 1.1 2.6 2.4 3.1-.4-2.8-.2-5.5.5-8Z"/>',
  ap: '<path d="M12 3.5c.7 4.6 3.4 7.3 8 8-4.6.7-7.3 3.4-8 8-.7-4.6-3.4-7.3-8-8 4.6-.7 7.3-3.4 8-8Z"/>',
  haste: '<path d="M7 3.5h10M7 20.5h10"/><path d="M8 3.5c0 4.5 4 5.5 4 8.5s-4 4-4 8.5M16 3.5c0 4.5-4 5.5-4 8.5s4 4 4 8.5"/>',
  crit: '<path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><path d="m8.5 8.5 7 7M15.5 8.5l-7 7"/>',
  pen: '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6Z" opacity=".45"/><path d="M3 21 21 3M15 3h6v6"/>',
  vamp: '<path d="M12 3s-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-6-11-6-11Z"/><path d="m9.5 13 1.5 3 1.5-3 1.5 3"/>',
  gold: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/>',
  tenacity: '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6Z"/><path d="M9 12h6"/>',
};

/** Иконки сайта: интерфейс движка плюс классы, линии и характеристики LoL. */
export const Icon = createIcon(LOL_ICONS);
