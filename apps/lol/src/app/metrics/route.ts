import { SITE_URL } from '@/lib/i18n';
export const runtime = 'nodejs';
const names = new Set(['page_view','client_error','LCP','INP','CLS','FCP','TTFB']);
const pages = new Set(['home','champions','items','builds','compare','duel','stats','tier-list','guess','runeterra','methodology','other']);
let windowStart = 0;
let count = 0;
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(SITE_URL).origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const now = Date.now();
  if (now - windowStart > 60000) { windowStart = now; count = 0; }
  if (++count > 600) return new Response(null, { status: 429 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  let length = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const part = await reader.read(); if (part.done) break;
    length += part.value.byteLength;
    if (length > 1024) { await reader.cancel(); return new Response(null, { status: 413 }); }
    chunks.push(part.value);
  }
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
    if (!names.has(String(payload.name)) || !pages.has(String(payload.page)) || typeof payload.value !== 'number' || !Number.isFinite(payload.value) || payload.value < 0 || payload.value > 1e6) return new Response(null, { status: 400 });
    console.info(JSON.stringify({ type: 'riftden_metric', timestamp: new Date().toISOString(), name: payload.name, value: payload.value, page: payload.page }));
    return new Response(null, { status: 204 });
  } catch { return new Response(null, { status: 400 }); }
}
