import Link from 'next/link';
import { useRouter } from 'next/router';
import { FileText, Users, Settings, LogOut } from 'lucide-react';
import { clearSession, getUser } from '../../lib/auth';

const nav = [
  { href: '/dashboard', label: 'Documents', icon: FileText },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const router = useRouter();
  const user = getUser();

  function handleLogout() {
    clearSession();
    router.push('/login');
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-60 border-r border-gray-200 bg-white flex flex-col z-10">
      <div className="h-14 flex items-center px-5 border-b border-gray-200">
        <span className="text-sm font-semibold tracking-tight">Opensign</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = router.pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-200">
        <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="text-sm text-gray-700 truncate">{user?.email || ''}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 w-full transition-colors"
        >
          <LogOut size={15} strokeWidth={1.75} />
          Log out
        </button>
      </div>
    </aside>
  );
}
