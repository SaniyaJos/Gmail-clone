// frontend/src/services/api.js (Line 1)
export const API_BASE = '/api';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || 'null');
  } catch {
    return null;
  }
}

export function getAuthHeaders(extraHeaders = {}) {
  const user = getCurrentUser();
  const headers = { ...extraHeaders };
  if (user?.token) {
    headers['Authorization'] = `Bearer ${user.token}`;
  }
  if (user?.email) {
    headers['x-user-email'] = user.email;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = getAuthHeaders(options.headers || {});

  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  } else {
    data = await response.text().catch(() => '');
  }

  if (!response.ok) {
    const errorMsg = (data && data.message) || response.statusText || 'Request failed';
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ==========================================
// AUTH API
// ==========================================
export const authApi = {
  async signIn(email, password) {
    return request('/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
  },

  async signUp(payload) {
    return request('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async checkUsername(email) {
    return request('/check-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
  },

  async health() {
    return request('/health');
  },

  async deleteAccount() {
    return request('/account', {
      method: 'DELETE'
    });
  }
};

// ==========================================
// EMAIL API
// ==========================================
export const emailApi = {
  async getEmails({ email, folder, q, labelId }) {
    const params = new URLSearchParams({ email, folder });
    if (q) params.set('q', q);
    if (labelId) params.set('labelId', labelId);
    return request(`/emails?${params.toString()}`);
  },

  async getEmailById(id) {
    return request(`/emails/${id}`);
  },

  async getEmailThread(id) {
    return request(`/emails/${id}/thread`);
  },

  async getCounts() {
    return request('/emails/counts');
  },

  async createEmail(payload) {
    return request('/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async undoSend(id) {
    return request(`/emails/${id}/undo-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async updateEmail(id, updateFields) {
    return request(`/emails/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateFields)
    });
  },

  async updateDraft(id, payload) {
    return request(`/emails/${id}/draft`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async deleteEmail(id) {
    return request(`/emails/${id}`, {
      method: 'DELETE'
    });
  },

  async emptyFolder(folder) {
    return request(`/emails/folder/${folder}/empty`, {
      method: 'DELETE'
    });
  },

  async markRead(id) {
    return request(`/emails/${id}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
  },

  async markUnread(id) {
    return request(`/emails/${id}/unread`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
  },

  async reportSpam(id) {
    return request(`/emails/${id}/report-spam`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
  },

  async markNotSpam(id) {
    return request(`/emails/${id}/not-spam`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
  },

  async uploadAttachments(draftId, files) {
    const formData = new FormData();
    files.forEach(file => formData.append('attachments', file));
    return request(`/emails/${draftId}/attachments`, {
      method: 'POST',
      body: formData
    });
  },

  async deleteAttachment(draftId, attachmentId) {
    return request(`/emails/${draftId}/attachments/${attachmentId}`, {
      method: 'DELETE'
    });
  },

  getAttachmentDownloadUrl(emailId, attachmentId) {
    const user = getCurrentUser();
    const tokenParam = user?.token ? `?token=${encodeURIComponent(user.token)}` : '';
    return `${API_BASE}/emails/${emailId}/attachments/${attachmentId}/download${tokenParam}`;
  },

  getAttachmentPreviewUrl(emailId, attachmentId) {
    const user = getCurrentUser();
    const tokenParam = user?.token ? `?token=${encodeURIComponent(user.token)}` : '';
    return `${API_BASE}/emails/${emailId}/attachments/${attachmentId}/preview${tokenParam}`;
  },

  async bulkUpdateLabels(emailIds, labelId, action) {
    return request('/emails/bulk-labels', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailIds, labelId, action })
    });
  }
};

// ==========================================
// LABEL API
// ==========================================
export const labelApi = {
  async getLabels() {
    return request('/labels');
  },

  async createLabel(name) {
    return request('/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
  },

  async renameLabel(id, name) {
    return request(`/labels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
  },

  async deleteLabel(id) {
    return request(`/labels/${id}`, {
      method: 'DELETE'
    });
  }
};

// ==========================================
// TASKS (EMAIL-TO-ACTION) API
// ==========================================
export const taskApi = {
  async getTasks(params = {}) {
    const query = new URLSearchParams(params);
    return request(`/tasks?${query.toString()}`);
  },

  async extractActions(emailId, forceRefresh = false) {
    return request('/tasks/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, forceRefresh })
    });
  },

  async updateTask(id, updateFields) {
    return request(`/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateFields)
    });
  },

  async deleteTask(id) {
    return request(`/tasks/${id}`, {
      method: 'DELETE'
    });
  },

  async getTaskEmail(id) {
    return request(`/tasks/${id}/email`);
  }
};
