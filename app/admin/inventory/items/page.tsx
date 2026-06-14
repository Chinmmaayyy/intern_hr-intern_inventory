import { getSession } from '@/app/lib/session';
import ItemsPageClient from './ItemsPageClient';

export default async function ItemsPage() {
  const session = await getSession();
  return <ItemsPageClient userRole={session?.role} />;
}
