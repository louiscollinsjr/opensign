import { getToken } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  auth: {
    register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    me: () => request('/api/auth/me'),
  },
  envelopes: {
    list: () => request('/api/envelopes'),
    create: (body) => request('/api/envelopes', { method: 'POST', body: JSON.stringify(body) }),
    get: (id) => request(`/api/envelopes/${id}`),
    delete: (id) => request(`/api/envelopes/${id}`, { method: 'DELETE' }),
    upload: (id, formData) => {
      const token = getToken();
      return fetch(`${BASE}/api/envelopes/${id}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Upload failed: ${res.status}`);
        return data;
      });
    },
    saveRecipients: (id, recipients) =>
      request(`/api/envelopes/${id}/recipients`, { method: 'PUT', body: JSON.stringify({ recipients }) }),
    saveFields: (id, fields) =>
      request(`/api/envelopes/${id}/fields`, { method: 'PUT', body: JSON.stringify({ fields }) }),
    send: (id) => request(`/api/envelopes/${id}/send`, { method: 'POST' }),
    download: (id) => request(`/api/envelopes/${id}/download`),
  },
  sign: {
    get: (token) => request(`/api/sign/${token}`),
    submit: (token, values) =>
      request(`/api/sign/${token}`, { method: 'POST', body: JSON.stringify({ values }) }),
  },
};
