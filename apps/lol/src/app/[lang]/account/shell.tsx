// Общая оболочка страниц аккаунта: статический заголовок, содержимое — клиентское. В поиск не попадают.
import type { Metadata } from 'next';
import { PageHead } from '@rift/engine/ui/PageHead';

export const privateMetadata = (title: string): Metadata => ({ title, robots: { index: false, follow: false } });

export function AccountShell({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="container" style={{ maxWidth: 900, paddingBottom: 64 }}>
      <PageHead title={title}>{lead}</PageHead>
      {children}
    </div>
  );
}
