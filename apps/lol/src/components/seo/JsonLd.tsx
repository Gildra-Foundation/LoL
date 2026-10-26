/** Server-rendered structured data. Escape HTML delimiters before embedding JSON.
 * https://nextjs.org/docs/app/guides/json-ld */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
