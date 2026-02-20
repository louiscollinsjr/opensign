import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import { Send, Plus, Trash2, ChevronLeft, ChevronRight, Link, Copy, CheckCircle } from 'lucide-react';
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
  const [resending, setResending] = useState(false);
  const [signingLinks, setSigningLinks] = useState([]); // populated after send
  const [copiedId, setCopiedId] = useState(null); // tracks which link was just copied
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
      // If already sent, pre-load signing links for the copy-link panel
      if (env.status === 'sent' || env.status === 'completed') {
        api.envelopes.links(id).then(({ links }) => setSigningLinks(links)).catch(() => {});
      }
    }).catch((err) => toast.error(err.message));
  }, [id, router]);

  // Called by PdfViewer once the PDF finishes loading in the browser.
  // If react-pdf reports a different page count than what's stored, patch it silently.
  const handleNumPages = useCallback((numPages) => {
    if (!id || !numPages) return;
    setPageCount(numPages);
    setEnvelope((prev) => {
      if (!prev || prev.pageCount === numPages) return prev;
      // Fire-and-forget — if this fails it's non-critical
      api.envelopes.patch(id, { pageCount: numPages }).catch(() => {});
      return { ...prev, pageCount: numPages };
    });
  }, [id]);

  function handleOverlayClick(e) {
    if (!overlayRef.current) return;
    if (recipients.length === 0) {
      toast.error('Add a recipient first, then click to place a field');
      return;
    }
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
      // Always reload current recipients from server first so we have the real MongoDB _ids
      const freshData = await api.envelopes.get(id);
      const serverRecipients = freshData.recipients;

      let recipientIdMap = {};

      if (envelope.status === 'draft') {
        // In draft: replace recipients (this regenerates tokens, which is fine pre-send).
        // Build a map from local/stale _id → server _id by matching on email.
        const savedRecipients = await api.envelopes.saveRecipients(id, recipients.map((r, i) => ({
          name: r.name, email: r.email, order: i,
        })));
        setRecipients(savedRecipients);

        // Map by email: stale local/old ID → new server ID
        recipients.forEach((localR) => {
          const match = savedRecipients.find((sr) => sr.email === localR.email);
          if (match) recipientIdMap[localR._id] = match._id;
        });
      } else {
        // Post-send: recipients are stable — just build an email→_id map for any local IDs
        recipients.forEach((localR) => {
          const match = serverRecipients.find((sr) => sr.email === localR.email);
          if (match) recipientIdMap[localR._id] = match._id;
        });
      }

      // Resolve each field's recipientId to a real server ID
      const resolvedFields = fields.map((f) => ({
        recipientId: recipientIdMap[f.recipientId] || f.recipientId,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        type: f.type,
        required: f.required,
      }));

      const savedFields = await api.envelopes.saveFields(id, resolvedFields);

      // Update local field state with real server _ids so future saves stay consistent
      setFields(savedFields.map((sf, i) => ({
        ...resolvedFields[i],
        ...sf,
        localId: fields[i]?.localId ?? ++fieldIdCounter,
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
      const result = await api.envelopes.send(id);
      // Fetch signing links so the owner can copy them manually
      const { links } = await api.envelopes.links(id);
      setSigningLinks(links);
      setEnvelope((prev) => ({ ...prev, status: 'sent' }));
      if (result.emailErrors?.length) {
        toast.warning(`Sent, but ${result.emailErrors.length} email(s) failed — use Copy Link below`);
      } else {
        toast.success('Document sent! Emails delivered.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    if (recipients.length === 0) return toast.error('No recipients');
    setResending(true);
    try {
      // Save field layout without touching recipients/tokens
      await api.envelopes.saveFields(id, fields.map((f) => ({
        recipientId: f.recipientId,
        page: f.page, x: f.x, y: f.y,
        width: f.width, height: f.height,
        type: f.type, required: f.required,
      })));
      // Re-send emails to all pending recipients
      const result = await api.envelopes.send(id);
      const { links } = await api.envelopes.links(id);
      setSigningLinks(links);
      if (result.emailErrors?.length) {
        toast.warning(`Resent, but ${result.emailErrors.length} email(s) failed — use Copy Link below`);
      } else {
        toast.success('Emails resent!');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResending(false);
    }
  }

  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link.signingUrl);
      setCopiedId(link.recipientId);
      toast.success(`Link copied for ${link.name}`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback: show the URL in a prompt so the user can copy manually
      window.prompt(`Copy this link for ${link.name}:`, link.signingUrl);
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
      {envelope.status === 'draft' ? (
        <button
          onClick={handleSend}
          disabled={sending}
          className="inline-flex items-center gap-1.5 bg-black text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          <Send size={13} />
          {sending ? 'Sending…' : 'Send'}
        </button>
      ) : envelope.status === 'sent' ? (
        <button
          onClick={handleResend}
          disabled={resending}
          className="inline-flex items-center gap-1.5 bg-gray-700 text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-600 disabled:opacity-50 transition-colors"
          title="Re-send invitation emails to all recipients"
        >
          <Send size={13} />
          {resending ? 'Resending…' : 'Resend'}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 rounded-md px-3 py-1.5 text-sm font-medium">
          <Send size={13} />
          Completed
        </span>
      )}
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
              {/* pointer-events:none lets clicks pass through the PDF canvas to the overlay */}
              <div style={{ pointerEvents: 'none' }}>
                <PdfViewer
                  url={envelope.pdfUrl}
                  page={page}
                  onDimsChange={setPdfDims}
                  onNumPages={handleNumPages}
                />
              </div>
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

          {/* Signing links — shown once the envelope is sent */}
          {signingLinks.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Signing Links</h3>
              <p className="text-xs text-gray-400 mb-3">Share directly if email fails</p>
              <div className="space-y-2">
                {signingLinks.map((link) => (
                  <div key={link.recipientId} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{link.name}</p>
                      <p className={`text-[10px] capitalize ${link.status === 'signed' ? 'text-green-600' : 'text-gray-400'}`}>
                        {link.status}
                      </p>
                    </div>
                    <button
                      onClick={() => copyLink(link)}
                      disabled={link.status === 'signed'}
                      className="flex-shrink-0 flex items-center gap-1 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                      title={link.status === 'signed' ? 'Already signed' : `Copy link for ${link.name}`}
                    >
                      {copiedId === link.recipientId
                        ? <><CheckCircle size={10} className="text-green-600" /> Copied</>
                        : <><Copy size={10} /> Copy</>
                      }
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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

  const isSignature = field.type === 'signature' || field.type === 'initials';
  const tabLabel = isSignature ? 'Sign here' : `Enter ${field.type}`;

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
        userSelect: 'none',
      }}
    >
      {/* Left-justified label above — type · recipient */}
      <span style={{
        position: 'absolute',
        top: '-1.15em',
        left: 0,
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        color: selected ? '#1e3a8a' : '#1e40af',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>
        {field.type}{recipient ? ` · ${recipient.name}` : ''}
      </span>

      {/* Field body — dashed blue border, semi-transparent fill */}
      <div style={{
        width: '100%',
        height: '100%',
        border: selected ? '2px solid #1e3a8a' : '2px dashed #3b82f6',
        borderRadius: '3px',
        background: selected ? 'rgba(191,219,254,0.55)' : 'rgba(219,234,254,0.40)',
        boxShadow: selected ? '0 0 0 2px #1e3a8a33' : 'none',
        transition: 'border 0.1s, background 0.1s',
        position: 'relative',
        boxSizing: 'border-box',
      }}>
        {/* "Sign here" sticky tab at bottom-left */}
        <div style={{
          position: 'absolute',
          left: 0,
          bottom: '-1.6em',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          background: selected ? '#1e3a8a' : '#1d4ed8',
          borderRadius: '0 0 4px 4px',
          padding: '1px 6px 2px 4px',
          pointerEvents: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          zIndex: 21,
        }}>
          <span style={{ color: '#fde047', fontSize: '10px', lineHeight: 1, fontWeight: 900 }}>▲</span>
          <span style={{ color: '#fde047', fontSize: '9px', fontWeight: 700, letterSpacing: '0.03em' }}>
            {tabLabel}
          </span>
        </div>
      </div>

      {/* Remove button when selected */}
      {selected && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '16px',
            height: '16px',
            background: '#111827',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            cursor: 'pointer',
            zIndex: 25,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#111827'; }}
        >
          ×
        </button>
      )}
    </div>
  );
}
