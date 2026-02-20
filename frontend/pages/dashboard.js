import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, Download } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { api } from '../lib/api';
import { isLoggedIn } from '../lib/auth';

function StatusBadge({ status }) {
  const styles = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-gray-900 text-white',
    completed: 'bg-gray-100 text-gray-800 border border-gray-300',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.draft}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [envelopes, setEnvelopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null); // track which envelope is being downloaded

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    api.envelopes.list()
      .then(setEnvelopes)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleDelete(env) {
    const label = env.status === 'draft' ? 'draft' : env.status === 'completed' ? 'completed document' : 'sent document';
    if (!confirm(`Delete this ${label}? This cannot be undone.`)) return;
    try {
      await api.envelopes.delete(env._id);
      setEnvelopes((prev) => prev.filter((e) => e._id !== env._id));
      toast.success('Document deleted');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDownload(env) {
    setDownloading(env._id);
    try {
      const { signedPdfUrl } = await api.envelopes.download(env._id);
      // Trigger a browser download by creating a temporary anchor
      const a = document.createElement('a');
      a.href = signedPdfUrl;
      a.download = `${env.title} (signed).pdf`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      toast.error(err.message || 'Could not download signed PDF');
    } finally {
      setDownloading(null);
    }
  }

  const action = (
    <Link
      href="/envelopes/new"
      className="inline-flex items-center gap-1.5 bg-black text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-800 transition-colors"
    >
      <Plus size={14} />
      New document
    </Link>
  );

  return (
    <AppShell title="Documents" action={action}>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : envelopes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FileText size={32} className="text-gray-300 mb-4" strokeWidth={1.25} />
          <h2 className="text-sm font-semibold text-gray-900 mb-1">No documents yet</h2>
          <p className="text-sm text-gray-500 mb-6">Upload a PDF and send it for signature.</p>
          <Link
            href="/envelopes/new"
            className="inline-flex items-center gap-1.5 bg-black text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus size={14} />
            New document
          </Link>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Title</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {envelopes.map((env) => (
                <tr key={env._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/envelopes/${env._id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {env.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={env.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(env.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {env.status === 'completed' && (
                        <button
                          onClick={() => handleDownload(env)}
                          disabled={downloading === env._id}
                          className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded disabled:opacity-40"
                          title="Download signed PDF"
                        >
                          <Download size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(env)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded"
                        title="Delete document"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
