import meta from '@/data/meta.json';
export const dynamic = 'force-static';
export function GET() {
  return Response.json({ status: 'ok', patch: meta.version, updatedAt: meta.fetchedAt });
}
