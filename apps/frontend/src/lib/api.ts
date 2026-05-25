const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${BASE}/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (networkErr: any) {
    
    throw new Error(
      `Network error — is the backend running on ${BASE}? (${networkErr.message})`,
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.message || body?.error || JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => res.statusText);
    }
    throw new Error(`[${res.status}] ${detail}`);
  }

  
  const text = await res.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${path}: ${text.slice(0, 120)}`);
  }
}

export const api = {
  getSnapshot: () => request<any>('/snapshot'),
  getMetrics: () => request<any>('/metrics'),
  getEvents: (limit = 100) => request<any>(`/events?limit=${limit}`),
  getFiles: () => request<any>('/files'),

  addNode: (count = 1) =>
    request<any>('/nodes', {
      method: 'POST',
      body: JSON.stringify({ count }),
    }),

  killNode: (id: string) => request<any>(`/nodes/${id}`, { method: 'DELETE' }),

  
  publishFile: (fileName: string, data: string, fromNodeId?: string) => {
    
    let encoded: string;
    try {
      encoded = btoa(unescape(encodeURIComponent(data || ' ')));
    } catch {
      encoded = btoa(data || ' ');
    }
    return request<any>('/files', {
      method: 'POST',
      body: JSON.stringify({
        fileName: fileName.trim(),
        data: encoded,
        ...(fromNodeId ? { fromNodeId } : {}),
      }),
    });
  },

  lookupFile: (fileId: string, fromNodeId?: string) =>
    request<any>('/files/lookup', {
      method: 'POST',
      body: JSON.stringify({
        fileId: fileId.trim(),
        ...(fromNodeId ? { fromNodeId } : {}),
      }),
    }),

  launchAttack: (
    type: 'SYBIL' | 'ECLIPSE',
    targetNodeId?: string,
    sybilCount = 5,
  ) =>
    request<any>('/attacks', {
      method: 'POST',
      body: JSON.stringify({
        type,
        sybilCount,
        ...(targetNodeId ? { targetNodeId } : {}),
      }),
    }),
};
