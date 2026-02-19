import Sidebar from './Sidebar';

export default function AppShell({ title, action, children }) {
  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <div className="pl-60">
        <header className="h-14 border-b border-gray-200 flex items-center justify-between px-6">
          <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
          {action && <div>{action}</div>}
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
