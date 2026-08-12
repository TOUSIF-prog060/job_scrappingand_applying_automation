/**
 * Thin API wrapper layer — all fetch calls go through here.
 */

const BASE = '/api';

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export async function fetchJobs() {
  const res = await fetch(`${BASE}/jobs`);
  return handleResponse(res);
}

export async function fetchJob(id) {
  const res = await fetch(`${BASE}/jobs/${id}`);
  return handleResponse(res);
}

export async function triggerScrape() {
  const res = await fetch(`${BASE}/jobs/scrape`, { method: 'POST' });
  return handleResponse(res);
}

// ── Applications ──────────────────────────────────────────────────────────────

export async function applyToJob(jobId, allowSubmit = false) {
  const res = await fetch(`${BASE}/applications/${jobId}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allowSubmit }),
  });
  return handleResponse(res);
}

export async function applyToAll(allowSubmit = false) {
  const res = await fetch(`${BASE}/applications/apply-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allowSubmit }),
  });
  return handleResponse(res);
}

export async function fetchJobStatus(jobId) {
  const res = await fetch(`${BASE}/applications/${jobId}/status`);
  return handleResponse(res);
}

export async function fetchApplyAllProgress() {
  const res = await fetch(`${BASE}/applications/progress`);
  return handleResponse(res);
}

export function getScreenshotUrl(jobId) {
  return `${BASE}/applications/${jobId}/screenshot`;
}

// ── Candidate ─────────────────────────────────────────────────────────────────

export async function fetchCandidate() {
  const res = await fetch(`${BASE}/candidate`);
  return handleResponse(res);
}

export async function updateCandidate(data) {
  const res = await fetch(`${BASE}/candidate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function uploadResume(file) {
  const form = new FormData();
  form.append('resume', file);
  const res = await fetch(`${BASE}/candidate/resume`, { method: 'POST', body: form });
  return handleResponse(res);
}
