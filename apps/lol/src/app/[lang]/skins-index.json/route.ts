import { langOf, localeParams } from '@/lib/i18n';
import { skinsLite } from '@/lib/skins';

// Облегчённый список всех образов для каталога и избранного: собирается при сборке на каждом языке.
export const dynamic = 'force-static';
export const dynamicParams = false;
export const generateStaticParams = localeParams;

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  return Response.json(skinsLite(await langOf(params)));
}
