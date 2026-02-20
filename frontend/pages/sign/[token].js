import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import { CheckCircle } from 'lucide-react';
import { api } from '../../lib/api';
import dynamic from 'next/dynamic';

const PdfViewer = dynamic(() => import('../../components/builder/PdfViewer'), { ssr: false });

export default function SignPage() {
  const router = useRouter();
  const { token } = router.query;

  const [data, setData] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    api.sign.get(token)
      .then((d) => {
        setData(d);
        const initial = {};
        d.fields.forEach((f) => { initial[f._id] = f.value || ''; });
        setFieldValues(initial);
      })
      .catch((err) => toast.error(err.message));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!data) return;
    const missing = data.fields.filter((f) => f.required && !fieldValues[f._id]);
    if (missing.length > 0) {
      toast.error(`Please complete all required fields (${missing.length} remaining)`);
      return;
    }
    setSubmitting(true);
    try {
      const values = Object.entries(fieldValues).map(([fieldId, value]) => ({ fieldId, value }));
      await api.sign.submit(token, values);
      setDone(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <CheckCircle size={40} className="text-gray-900 mx-auto mb-4" strokeWidth={1.5} />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Document signed</h1>
          <p className="text-sm text-gray-500">Thank you. All parties will be notified when signing is complete.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading document…</p>
      </div>
    );
  }

  if (data.recipient.status === 'signed') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <CheckCircle size={40} className="text-gray-400 mx-auto mb-4" strokeWidth={1.5} />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Already signed</h1>
          <p className="text-sm text-gray-500">You have already signed this document.</p>
        </div>
      </div>
    );
  }

  const pageFields = data.fields.filter((f) => f.page === page);
  const pageCount = data.envelope.pageCount || 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6">
        <div>
          <span className="text-sm font-semibold text-gray-900">{data.envelope.title}</span>
          <span className="text-sm text-gray-400 ml-3">Signing as {data.recipient.name}</span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 bg-black text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Complete signing'}
        </button>
      </header>

      <div className="max-w-4xl mx-auto py-8 px-4 flex gap-6">
        {/* PDF + overlaid fields */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden relative">
            <div className="relative inline-block w-full">
              <PdfViewer url={data.envelope.pdfUrl} page={page} />
              {/* Field overlays */}
              <div className="absolute inset-0" style={{ zIndex: 10 }}>
                {pageFields.map((field) => (
                  <SignerFieldOverlay
                    key={field._id}
                    field={field}
                    value={fieldValues[field._id] || ''}
                    onChange={(val) => setFieldValues((prev) => ({ ...prev, [field._id]: val }))}
                  />
                ))}
              </div>
            </div>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500">Page {page} of {pageCount}</span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
                className="px-3 py-1.5 border border-gray-200 rounded text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Right: field checklist */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Fields ({data.fields.filter((f) => fieldValues[f._id]).length}/{data.fields.length})
            </h3>
            <div className="space-y-1.5">
              {data.fields.map((f) => {
                const filled = !!fieldValues[f._id];
                return (
                  <div
                    key={f._id}
                    onClick={() => setPage(f.page)}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:text-gray-900 transition-colors"
                  >
                    <div className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 ${filled ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`} />
                    <span className={`capitalize ${filled ? 'text-gray-500' : 'text-gray-700'}`}>
                      {filled ? '✓ ' : ''}{f.type}{!f.required ? ' (optional)' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignerFieldOverlay({ field, value, onChange }) {
  const [showInput, setShowInput] = useState(false);
  const isSignature = field.type === 'signature' || field.type === 'initials';
  const isDataUrl = value && value.startsWith('data:');

  return (
    <div
      style={{
        position: 'absolute',
        left: `${field.x * 100}%`,
        top: `${field.y * 100}%`,
        width: `${field.width * 100}%`,
        height: `${field.height * 100}%`,
        zIndex: 20,
      }}
    >
      {value ? (
        <div
          onClick={() => setShowInput(true)}
          className="w-full h-full border-2 border-gray-900 bg-white rounded flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden"
        >
          {isDataUrl ? (
            // Render drawn signatures/initials as an image
            <img src={value} alt={field.type} className="max-w-full max-h-full object-contain p-0.5" />
          ) : (
            <span className="text-xs text-gray-900 px-1 truncate font-medium">{value}</span>
          )}
        </div>
      ) : (
        <div
          onClick={() => setShowInput(true)}
          className="w-full h-full border-2 border-dashed border-gray-400 bg-white/80 rounded flex items-center justify-center cursor-pointer hover:border-gray-900 hover:bg-gray-50 transition-colors"
        >
          <span className="text-[10px] text-gray-500 capitalize">{field.type}{field.required ? ' *' : ''}</span>
        </div>
      )}

      {showInput && (
        <FieldInputModal
          field={field}
          value={value}
          onSave={(val) => { onChange(val); setShowInput(false); }}
          onClose={() => setShowInput(false)}
        />
      )}
    </div>
  );
}

function FieldInputModal({ field, value, onSave, onClose }) {
  const [val, setVal] = useState(value || '');
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const isSignature = field.type === 'signature' || field.type === 'initials';

  useEffect(() => {
    if (!isSignature || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, [isSignature]);

  function startDraw(e) {
    drawing.current = true;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function draw(e) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }

  function endDraw() {
    drawing.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function handleSave() {
    if (isSignature) {
      const dataUrl = canvasRef.current.toDataURL();
      onSave(dataUrl);
    } else {
      onSave(val);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg border border-gray-200 p-5 w-80 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 capitalize">{field.type}</h3>

        {isSignature ? (
          <div>
            <canvas
              ref={canvasRef}
              width={280}
              height={100}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              className="border border-gray-200 rounded w-full cursor-crosshair bg-gray-50"
            />
            <button onClick={clearCanvas} className="text-xs text-gray-400 hover:text-gray-700 mt-1">Clear</button>
          </div>
        ) : (
          <input
            type={field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : 'text'}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            autoFocus
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder={`Enter ${field.type}`}
          />
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            className="flex-1 bg-black text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Apply
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
