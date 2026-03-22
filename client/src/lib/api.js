const BASE = '';

async function request(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.data !== undefined ? data.data : data;
}

export const api = {
  // Keywords
  getKeywords: () => request('/api/keywords'),
  createKeyword: (body) => request('/api/keywords', { method: 'POST', body: JSON.stringify(body) }),
  updateKeyword: (id, body) => request(`/api/keywords/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteKeyword: (id) => request(`/api/keywords/${id}`, { method: 'DELETE' }),
  toggleKeyword: (id) => request(`/api/keywords/${id}/toggle`, { method: 'PUT' }),

  // Hotspots
  getHotspots: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/hotspots${qs ? '?' + qs : ''}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  },
  getHotspot: (id) => request(`/api/hotspots/${id}`),
  refreshHotspots: () => request('/api/hotspots/refresh', { method: 'POST' }),
  getStats: () => request('/api/hotspots/stats/overview'),

  // Notifications
  getNotifications: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/notifications${qs ? '?' + qs : ''}`);
  },
  markRead: (id) => request(`/api/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () => request('/api/notifications/read-all', { method: 'PUT' }),

  // Settings
  getSettings: () => request('/api/settings'),
  updateSettings: (body) => request('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
};
