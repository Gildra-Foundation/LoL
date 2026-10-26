import { getBuildData } from '@/lib/build-data';
import { langOf, localeParams } from '@/lib/i18n';
export const dynamic = 'force-static';
export const dynamicParams = false;
export const generateStaticParams = localeParams;
export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  return Response.json(getBuildData(await langOf(params)));
}
