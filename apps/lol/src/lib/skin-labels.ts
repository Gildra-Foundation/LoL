// Подписи образов: доступность, цена, что нового. Общие для сервера и браузера.
import { defineMessages } from '@rift/engine/i18n/locale';

export const AVAILABILITY = defineMessages({
  ru: {
    available: 'В магазине',
    bundle: 'В наборе',
    loot: 'Только из трофеев',
    legacy: 'Наследие',
    limited: 'Ограниченный',
    rare: 'Редкий выпуск',
    partner: 'Партнёрский',
    upcoming: 'Скоро',
    canceled: 'Отменён',
    removed: 'Удалён',
  } as Record<string, string>,
  en: {
    available: 'In store',
    bundle: 'Bundle',
    loot: 'Loot only',
    legacy: 'Legacy',
    limited: 'Limited',
    rare: 'Rare release',
    partner: 'Partner',
    upcoming: 'Upcoming',
    canceled: 'Canceled',
    removed: 'Removed',
  } as Record<string, string>,
});

export const COST_NOTE = defineMessages({
  ru: { special: 'Особая цена', pass: 'Боевой пропуск', sanctum: 'Святилище' } as Record<string, string>,
  en: { special: 'Special price', pass: 'Battle Pass', sanctum: 'Sanctum' } as Record<string, string>,
});

export const NEW_FEATURES = defineMessages({
  ru: { voice: 'Новая озвучка', quotes: 'Новые реплики', effects: 'Новые эффекты', animations: 'Новые анимации', recall: 'Новое возвращение', transforming: 'Превращение в бою' },
  en: { voice: 'New voice', quotes: 'New quotes', effects: 'New effects', animations: 'New animations', recall: 'New recall', transforming: 'Transforms in game' },
});
