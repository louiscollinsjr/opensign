import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Settings as SettingsIcon } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { isLoggedIn, getUser } from '../lib/auth';

export default function Settings() {
  const router = useRouter();
  const user = getUser();

  useEffect(() => {
    if (!isLoggedIn()) router.replace('/login');
  }, [router]);

  return (
    <AppShell title="Settings">
      <div className="max-w-md">
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          <div className="px-4 py-3">
            <p className="text-xs text-gray-500 mb-0.5">Name</p>
            <p className="text-sm font-medium text-gray-900">{user?.name || '—'}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-gray-500 mb-0.5">Email</p>
            <p className="text-sm font-medium text-gray-900">{user?.email || '—'}</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
