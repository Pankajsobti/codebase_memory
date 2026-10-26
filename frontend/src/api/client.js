const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed with status ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function createRepo(repoUrl) {
  return request('/repos', {
    method: 'POST',
    body: JSON.stringify({ repoUrl }),
  });
}

export function getRepos() {
  return request('/repos', {
    method: 'GET',
  });
}

export function getRepo(repoId) {
  return request(`/repos/${repoId}`, {
    method: 'GET',
  });
}

export function deleteRepo(repoId) {
  return request(`/repos/${repoId}`, {
    method: 'DELETE',
  });
}

export function getGraph(repoId, type) {
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  return request(`/repos/${repoId}/graph${query}`, {
    method: 'GET',
  });
}

export function askQuestion(repoId, question) {
  return request(`/repos/${repoId}/qa`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

export function getFileRecord(repoId, filePath) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  return request(`/repos/${repoId}/files/${encodedPath}`, {
    method: 'GET',
  });
}

export function getSummary(repoId) {
  return request(`/repos/${repoId}/summary`, {
    method: 'GET',
  });
}

export default {
  createRepo,
  getRepos,
  getRepo,
  deleteRepo,
  getGraph,
  getFileRecord,
  askQuestion,
  getSummary,
};