import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import { Upload, FileText } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { api } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';
import { useEffect } from 'react';

export default function NewEnvelope() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) router.replace('/login');
  }, [router]);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped);
      if (!title) setTitle(dropped.name.replace(/\.pdf$/i, ''));
    } else {
      toast.error('Please drop a PDF file');
    }
  }

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      if (!title) setTitle(selected.name.replace(/\.pdf$/i, ''));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return toast.error('Please select a PDF');
    if (!title.trim()) return toast.error('Please enter a title');
    setLoading(true);
    try {
      const envelope = await api.envelopes.create({ title: title.trim() });
      const formData = new FormData();
      formData.append('pdf', file);
      await api.envelopes.upload(envelope._id, formData);
      toast.success('Document created');
      router.push(`/envelopes/${envelope._id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="New document">
      <div className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Document title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="e.g. Service Agreement"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">PDF file</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                dragging ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {file ? (
                <>
                  <FileText size={28} className="text-gray-400 mb-3" strokeWidth={1.25} />
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
                </>
              ) : (
                <>
                  <Upload size={28} className="text-gray-300 mb-3" strokeWidth={1.25} />
                  <p className="text-sm font-medium text-gray-900">Drop your PDF here</p>
                  <p className="text-xs text-gray-500 mt-1">or click to browse · max 20 MB</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={loading || !file}
              className="bg-black text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Uploading…' : 'Continue to builder'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="border border-gray-200 bg-white rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
