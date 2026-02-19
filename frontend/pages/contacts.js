import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Users } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { isLoggedIn } from '../lib/auth';

export default function Contacts() {
  const router = useRouter();
  useEffect(() => {
    if (!isLoggedIn()) router.replace('/login');
  }, [router]);

  return (
    <AppShell title="Contacts">
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Users size={32} className="text-gray-300 mb-4" strokeWidth={1.25} />
        <h2 className="text-sm font-semibold text-gray-900 mb-1">No contacts yet</h2>
        <p className="text-sm text-gray-500">Contacts will appear here after you send documents.</p>
      </div>
    </AppShell>
  );
}
