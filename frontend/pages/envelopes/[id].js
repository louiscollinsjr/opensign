import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import { Send, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { api } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';
import dynamic from 'next/dynamic';

const PdfViewer = dynamic(() => import('../../components/builder/PdfViewer'), { ssr: false });

const FIELD_TYPES = ['signature', 'initials', 'name', 'email', 'date', 'text'];

const FIELD_COLORS = {
  signature: 'border-gray-900 bg-gray-900/5',
  initials: 'border-gray-700 bg-gray-700/5',
  name: 'border-gray-500 bg-gray-500/5',
  email: 'border-gray-400 bg-gray-400/5',
  date: 'border-gray-600 bg-gray-600/5',
  text: 'border-gray-300 bg-gray-300/5',
};

let fieldIdCounter = 0;

export default function EnvelopeBuilder() {
  const router = useRouter();
  const { id } = router.query;

  const [envelope, setEnvelope] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [activeFieldType, setActiveFieldType] = useState('signature');
  const [activeRecipientIdx, setActiveRecipientIdx] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [pdfDims, setPdfDims] = useState({ width: 0, height: 0 });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [newRecipient, setNewRecipient] = useState({ name: '', email: '' });
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return; }
    if (!id) return;
    api.envelopes.get(id).then(({ envelope: env, recipients: recs, fields: flds }) => {
      setEnvelope(env);
      setRecipients(recs);
      setPageCount(env.pageCount || 1);
      setFields(flds.map((f) => ({ ...f, localId: ++fieldIdCounter })));
    }).catch((err) => toast.error(err.message));
  }, [id, router]);

  function handleOverlayClick(e) {
    if (!overlayRef.current || recipients.length === 0) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    const recipient = recipients[activeRecipientIdx];
    if (!recipient) return;
    const newField = {
      localId: ++fieldIdCounter,
      envelopeId: id,
      recipientId: recipient._id,
      page,
      x: xPct,
      y: yPct,
      width: 0.18,
      height: 0.05,
      type: activeFieldType,
      required: true,
      value: null,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedField(newField.localId);
  }

  function removeField(localId) {
    setFields((prev) => prev.filter((f) => f.localId !== localId));
    if (selectedField === localId) setSelectedField(null);
  }

  function updateField(localId, updates) {
    setFields((prev) => prev.map((f) => f.localId === localId ? { ...f, ...updates } : f));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const savedRecipients = await api.envelopes.saveRecipients(id, recipients.map((r, i) => ({
        name: r.name, email: r.email, order: i,
      })));
      setRecipients(savedRecipients);
      const oldToNew = {};
      recipients.forEach((r, i) => { if (savedRecipients[i]) oldToNew[r._id] = savedRecipients[i]._id; });
      await api.envelopes.saveFields(id, fields.map((f) => ({
        recipientId: oldToNew[f.recipientId] || f.recipientId,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        type: f.type,
        required: f.required,
      })));
      toast.success('Saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (recipients.length === 0) return toast.error('Add at least one recipient');
    if (fields.length === 0) return toast.error('Add at least one field');
    setSending(true);
    try {
      await handleSave();
      await api.envelopes.send(id);
      toast.success('Document sent for signature!');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  function addRecipient() {
    if (!newRecipient.name || !newRecipient.email) return toast.error('Name and email required');
    setRecipients((prev) => [...prev, { ...newRecipient, _id: `local-${Date.now()}`, status: 'pending' }]);
    setNewRecipient({ name: '', email: '' });
  }

  function removeRecipient(idx) {
    setRecipients((prev) => prev.filter((_, i) => i !== idx));
    setFields((prev) => prev.filter((f) => f.recipientId !== recipients[idx]?._id));
  }

  const pageFields = fields.filter((f) => f.page === page);
  const selectedFieldData = fields.find((f) => f.localId === selectedField);

  if (!envelope) {
    return (
      <AppShell title="Loading…">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />)}
        </div>
      </AppShell>
    );
  }

  const action = (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSave}
        disabled={saving}
        className="border border-gray-200 bg-white rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        onClick={handleSend}
        disabled={sending || envelope.status !== 'draft'}
        className="inline-flex items-center gap-1.5 bg-black text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        <Send size={13} />
        {sending ? 'Sending…' : envelope.status === 'draft' ? 'Send' : 'Sent'}
      </button>
    </div>
  );

  return (
    <AppShell title={envelope.title} action={action}>
      <div className="flex gap-6 h-[calc(100vh-7rem)]">
        {/* Left: PDF + field overlay */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Field type toolbar */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {FIELD_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setActiveFieldType(type)}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors capitalize ${
                  activeFieldType === type
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {type}
              </button>
            ))}
            <span className="text-xs text-gray-400 ml-2">Click on PDF to place field</span>
          </div>

          {/* PDF viewer with overlay */}
          <div className="flex-1 border border-gray-200 rounded-lg overflow-auto bg-gray-50 relative">
            <div className="relative inline-block" style={{ minWidth: '100%' }}>
              <PdfViewer
                url={envelope.pdfUrl}
                page={page}
                onDimsChange={setPdfDims}
              />
              {/* Clickable overlay for placing fields */}
              <div
                ref={overlayRef}
                onClick={handleOverlayClick}
                className="absolute inset-0 cursor-crosshair"
                style={{ zIndex: 10 }}
              >
                {pageFields.map((field) => (
                  <FieldBox
                    key={field.localId}
                    field={field}
                    selected={selectedField === field.localId}
                    onSelect={() => setSelectedField(field.localId)}
                    onRemove={() => removeField(field.localId)}
                    onUpdate={(updates) => updateField(field.localId, updates)}
                    recipient={recipients.find((r) => r._id === field.recipientId)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Page controls */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 mt-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-gray-500">Page {page} of {pageCount}</span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
                className="p-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Right: Recipients + field properties */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
          {/* Recipients */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Recipients</h3>
            <div className="space-y-2 mb-3">
              {recipients.map((r, i) => (
                <div
                  key={r._id || i}
                  onClick={() => setActiveRecipientIdx(i)}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer border text-xs transition-colors ${
                    activeRecipientIdx === i ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{r.name}</p>
                    <p className="text-gray-500 truncate">{r.email}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeRecipient(i); }}
                    className="text-gray-300 hover:text-gray-600 ml-2 flex-shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <input
                type="text"
                placeholder="Name"
                value={newRecipient.name}
                onChange={(e) => setNewRecipient((r) => ({ ...r, name: e.target.value }))}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <input
                type="email"
                placeholder="Email"
                value={newRecipient.email}
                onChange={(e) => setNewRecipient((r) => ({ ...r, email: e.target.value }))}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <button
                onClick={addRecipient}
                className="w-full flex items-center justify-center gap-1 border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Plus size={11} /> Add recipient
              </button>
            </div>
          </div>

          {/* Field properties */}
          {selectedFieldData && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Field</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Type</label>
                  <select
                    value={selectedFieldData.type}
                    onChange={(e) => updateField(selectedField, { type: e.target.value })}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none"
                  >
                    {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Recipient</label>
                  <select
                    value={selectedFieldData.recipientId}
                    onChange={(e) => updateField(selectedField, { recipientId: e.target.value })}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none"
                  >
                    {recipients.map((r) => (
                      <option key={r._id} value={r._id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFieldData.required}
                    onChange={(e) => updateField(selectedField, { required: e.target.checked })}
                    className="rounded"
                  />
                  Required
                </label>
                <button
                  onClick={() => removeField(selectedField)}
                  className="w-full flex items-center justify-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-100 rounded px-2 py-1.5 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={11} /> Remove field
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function FieldBox({ field, selected, onSelect, onRemove, onUpdate, recipient }) {
  const isDragging = useRef(false);
  const dragStart = useRef(null);
  const parentRef = useRef(null);

  function handleMouseDown(e) {
    e.stopPropagation();
    onSelect();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, fx: field.x, fy: field.y };

    function onMouseMove(ev) {
      if (!isDragging.current) return;
      const parent = parentRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dx = (ev.clientX - dragStart.current.x) / rect.width;
      const dy = (ev.clientY - dragStart.current.y) / rect.height;
      onUpdate({ x: Math.max(0, Math.min(1 - field.width, dragStart.current.fx + dx)), y: Math.max(0, Math.min(1 - field.height, dragStart.current.fy + dy)) });
    }

    function onMouseUp() {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  return (
    <div
      ref={parentRef}
      onMouseDown={handleMouseDown}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      style={{
        position: 'absolute',
        left: `${field.x * 100}%`,
        top: `${field.y * 100}%`,
        width: `${field.width * 100}%`,
        height: `${field.height * 100}%`,
        zIndex: 20,
        cursor: 'move',
      }}
      className={`border-2 rounded flex items-center justify-center select-none ${FIELD_COLORS[field.type] || 'border-gray-400 bg-gray-400/5'} ${selected ? 'ring-2 ring-gray-900 ring-offset-1' : ''}`}
    >
      <span className="text-[10px] font-medium text-gray-700 px-1 truncate capitalize">
        {field.type}{recipient ? ` · ${recipient.name}` : ''}
      </span>
      {selected && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-2 -right-2 w-4 h-4 bg-gray-900 text-white rounded-full flex items-center justify-center text-[9px] hover:bg-red-600 transition-colors"
        >
          ×
        </button>
      )}
    </div>
  );
}
