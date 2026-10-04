import { notFound } from 'next/navigation';

// Неизвестный адрес внутри языка: страница 404 в оформлении сайта и на языке страницы.
export default function Missing() {
  notFound();
}
