import { Application, Finding, Rule, AuditBlock, EvaluationMetrics, User, AgentVerificationReport, GeminiStatusResponse, AgentTraceStep } from './types';

/**
 * Normalizes user-entered or environment backend URL.
 * Handles whether the input contains or lacks `/api`, trailing slashes, or protocols.
 */
export function normalizeBackendUrl(input: string): { rootUrl: string; apiUrl: string } {
  let clean = (input || '').trim().replace(/\/+$/, '');
  if (!clean || clean === '/api' || clean === '/') {
    return { rootUrl: '', apiUrl: '/api' };
  }
  if (clean.endsWith('/api')) {
    const root = clean.slice(0, -4).replace(/\/+$/, '');
    return { rootUrl: root, apiUrl: clean };
  }
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return { rootUrl: clean, apiUrl: `${clean}/api` };
  }
  return { rootUrl: clean, apiUrl: `${clean}/api` };
}

export function getApiBaseUrl(): string {
  // 1. User manual override stored in localStorage
  const custom = localStorage.getItem('satyacheck_custom_backend_url');
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, '');
  }
  // 2. Vite environment variables
  const envUrl = ((import.meta as any).env?.VITE_API_BASE as string) || ((import.meta as any).env?.VITE_API_URL as string);
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  // 3. Default relative /api
  return '/api';
}

export function setCustomBackendUrl(url: string): void {
  if (url && url.trim()) {
    localStorage.setItem('satyacheck_custom_backend_url', url.trim().replace(/\/+$/, ''));
  } else {
    localStorage.removeItem('satyacheck_custom_backend_url');
  }
}

export function clearCustomBackendUrl(): void {
  localStorage.removeItem('satyacheck_custom_backend_url');
}

/**
 * Resolves an API path like `/applications` or `/agent/verify/1`
 * to the full URL pointing to the backend's `/api` endpoint.
 */
export function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const { apiUrl } = normalizeBackendUrl(getApiBaseUrl());
  let cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/api') && apiUrl.endsWith('/api')) {
    cleanPath = cleanPath.slice(4);
  }
  return `${apiUrl}${cleanPath}`;
}

async function handleJsonResponse(res: Response, url: string): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(
      `Backend returned HTML instead of API JSON for ${url}. If using a deployed frontend, please verify your deployed backend URL in Connection Settings.`
    );
  }
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`;
    try {
      const errJson = await res.json();
      detail = errJson.detail || errJson.message || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return res.json();
}

async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const url = resolveApiUrl(path);
  let token = localStorage.getItem('satyacheck_token');

  if (!token) {
    try {
      const loginUrl = resolveApiUrl('/auth/login');
      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'scrutiny_officer', password: 'officer123' })
      });
      if (loginRes.ok) {
        const authData = await loginRes.json();
        token = authData.access_token;
        localStorage.setItem('satyacheck_token', token);
      }
    } catch (e) {
      console.warn('Auto-login attempt failed (backend may be offline):', e);
    }
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) || {})
  };

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (netErr: any) {
    throw new Error(
      `Network error connecting to backend at ${url}. Ensure FastAPI is running and CORS allows your origin: ${netErr.message || netErr}`
    );
  }

  if (res.status === 401) {
    try {
      const loginUrl = resolveApiUrl('/auth/login');
      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'scrutiny_officer', password: 'officer123' })
      });
      if (loginRes.ok) {
        const authData = await loginRes.json();
        localStorage.setItem('satyacheck_token', authData.access_token);
        const retryHeaders: Record<string, string> = {
          Authorization: `Bearer ${authData.access_token}`,
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
          ...((options.headers as Record<string, string>) || {})
        };
        res = await fetch(url, { ...options, headers: retryHeaders });
      }
    } catch (e) {
      console.warn('Token refresh failed:', e);
    }
  }

  return res;
}

export const api = {
  getBaseUrl(): string {
    return getApiBaseUrl();
  },

  setBaseUrl(url: string) {
    setCustomBackendUrl(url);
  },

  resetBaseUrl() {
    clearCustomBackendUrl();
  },

  /**
   * Health probe that checks both `${apiUrl}/health` and `${rootUrl}/health`.
   * Accepts an optional candidate URL to test before saving.
   */
  async checkHealth(candidateUrl?: string): Promise<{ ok: boolean; status?: string; version?: string; error?: string; url: string }> {
    const targetBase = candidateUrl !== undefined ? candidateUrl : getApiBaseUrl();
    const { rootUrl, apiUrl } = normalizeBackendUrl(targetBase);

    const probeUrls: string[] = [];
    if (apiUrl) probeUrls.push(`${apiUrl}/health`);
    if (rootUrl && rootUrl !== apiUrl) probeUrls.push(`${rootUrl}/health`);
    if (rootUrl) probeUrls.push(`${rootUrl}/`);
    if (apiUrl && !probeUrls.includes(`${apiUrl}/`)) probeUrls.push(`${apiUrl}/`);

    let lastError = 'Connection refused';

    for (const url of probeUrls) {
      try {
        const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3500) });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          return { ok: true, status: data.status || 'healthy', version: data.version, url };
        }
      } catch (err: any) {
        lastError = err.message || lastError;
      }
    }

    return {
      ok: false,
      error: lastError,
      url: apiUrl || targetBase
    };
  },

  /**
   * Auto-detects local backend (e.g. 127.0.0.1:8000) or proxy if currently failing.
   */
  async autoDetectBackend(): Promise<{ detected: boolean; url?: string }> {
    const current = await this.checkHealth();
    if (current.ok) return { detected: true, url: getApiBaseUrl() };

    if (typeof window !== 'undefined') {
      const candidates = [
        'http://127.0.0.1:8000',
        'http://localhost:8000',
        'http://127.0.0.1:8000/api',
        '/api'
      ];
      for (const cand of candidates) {
        try {
          const test = await this.checkHealth(cand);
          if (test.ok) {
            setCustomBackendUrl(cand);
            return { detected: true, url: cand };
          }
        } catch {
          // ignore
        }
      }
    }
    return { detected: false };
  },

  async login(username: string, password: string): Promise<{ access_token: string; role: string; user_id: number; username: string }> {
    const url = resolveApiUrl('/auth/login');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await handleJsonResponse(res, url);
    localStorage.setItem('satyacheck_token', data.access_token);
    return data;
  },

  async getMe(): Promise<User> {
    const res = await fetchWithAuth('/auth/me');
    return handleJsonResponse(res, '/auth/me');
  },

  async getApplications(status?: string, category?: string, risk_level?: string): Promise<Application[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    if (risk_level) params.append('risk_level', risk_level);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchWithAuth(`/applications${queryString}`);
    return handleJsonResponse(res, `/applications${queryString}`);
  },

  async getApplication(id: number): Promise<Application> {
    const res = await fetchWithAuth(`/applications/${id}`);
    return handleJsonResponse(res, `/applications/${id}`);
  },

  async findApplicationByNumber(applicationNumber: string): Promise<Application | undefined> {
    const apps = await this.getApplications();
    return apps.find((a) => a.application_number === applicationNumber);
  },

  async runPreCheck(payload: any): Promise<any> {
    const res = await fetchWithAuth('/applications/pre-check', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return handleJsonResponse(res, '/applications/pre-check');
  },

  async exportReport(id: number): Promise<any> {
    const res = await fetchWithAuth(`/applications/${id}/export-report`);
    return handleJsonResponse(res, `/applications/${id}/export-report`);
  },

  async executeFindingAction(findingId: number, action: string, justification: string): Promise<Finding> {
    const res = await fetchWithAuth(`/findings/${findingId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, justification })
    });
    return handleJsonResponse(res, `/findings/${findingId}/action`);
  },

  async getRules(): Promise<Rule[]> {
    const res = await fetchWithAuth('/rules');
    return handleJsonResponse(res, '/rules');
  },

  async simulateRuleImpact(ruleCode: string, newParamValue: any): Promise<any> {
    const res = await fetchWithAuth('/rules/simulate', {
      method: 'POST',
      body: JSON.stringify({ rule_code: ruleCode, new_parameter_value: newParamValue })
    });
    return handleJsonResponse(res, '/rules/simulate');
  },

  async getAdapters(): Promise<any[]> {
    const res = await fetchWithAuth('/verification/adapters');
    return handleJsonResponse(res, '/verification/adapters');
  },

  async triggerVerification(docId: number): Promise<any> {
    const res = await fetchWithAuth(`/verification/verify-document/${docId}`, {
      method: 'POST'
    });
    return handleJsonResponse(res, `/verification/verify-document/${docId}`);
  },

  async getTimeline(appId: number): Promise<any[]> {
    const res = await fetchWithAuth(`/verification/timeline/${appId}`);
    return handleJsonResponse(res, `/verification/timeline/${appId}`);
  },

  async analyzeInfraPhoto(docId: number): Promise<any> {
    const res = await fetchWithAuth(`/infrastructure/analyze-photo/${docId}`, {
      method: 'POST'
    });
    return handleJsonResponse(res, `/infrastructure/analyze-photo/${docId}`);
  },

  async getKnowledgeGraph(appId: number): Promise<any> {
    const res = await fetchWithAuth(`/graph/${appId}`);
    return handleJsonResponse(res, `/graph/${appId}`);
  },

  async getAuditTrail(): Promise<AuditBlock[]> {
    const res = await fetchWithAuth('/audit');
    return handleJsonResponse(res, '/audit');
  },

  async verifyAuditIntegrity(): Promise<{ is_valid: boolean; total_blocks: number; message: string; tampered_blocks: number[] }> {
    const res = await fetchWithAuth('/audit/verify', {
      method: 'POST'
    });
    return handleJsonResponse(res, '/audit/verify');
  },

  async getEvaluationMetrics(): Promise<EvaluationMetrics> {
    const res = await fetchWithAuth('/evaluation/metrics');
    return handleJsonResponse(res, '/evaluation/metrics');
  },

  async runEvaluationBenchmark(): Promise<EvaluationMetrics> {
    const res = await fetchWithAuth('/evaluation/run', {
      method: 'POST'
    });
    return handleJsonResponse(res, '/evaluation/run');
  },

  // SatyaCheck AI Verification Agent APIs
  async getGeminiStatus(): Promise<GeminiStatusResponse> {
    const res = await fetchWithAuth('/agent/gemini-status');
    return handleJsonResponse(res, '/agent/gemini-status');
  },

  async runAgentVerification(
    applicationId: number,
    mode: 'auto' | 'gemini' | 'offline' = 'auto',
    scrutinyFocus?: string
  ): Promise<AgentVerificationReport> {
    const res = await fetchWithAuth(`/agent/verify/${applicationId}`, {
      method: 'POST',
      body: JSON.stringify({ mode, scrutiny_focus: scrutinyFocus })
    });
    return handleJsonResponse(res, `/agent/verify/${applicationId}`);
  },

  async getAgentStatus(executionId: string): Promise<any> {
    const res = await fetchWithAuth(`/agent/status/${executionId}`);
    return handleJsonResponse(res, `/agent/status/${executionId}`);
  },

  async getAgentTrace(executionId: string): Promise<{ execution_id: string; total_steps: number; trace: AgentTraceStep[] }> {
    const res = await fetchWithAuth(`/agent/trace/${executionId}`);
    return handleJsonResponse(res, `/agent/trace/${executionId}`);
  },

  async getAgentReport(executionId: string): Promise<AgentVerificationReport> {
    const res = await fetchWithAuth(`/agent/report/${executionId}`);
    return handleJsonResponse(res, `/agent/report/${executionId}`);
  },

  async getAgentHistory(applicationId: number): Promise<any[]> {
    const res = await fetchWithAuth(`/agent/history/${applicationId}`);
    return handleJsonResponse(res, `/agent/history/${applicationId}`);
  },

  async uploadDocument(applicationId: number, file: File): Promise<{
    success: boolean;
    document_id: number;
    application_id: number;
    doc_type: string;
    file_name: string;
    file_size: number;
    extracted_fields: any;
    message: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetchWithAuth(`/agent/upload-document/${applicationId}`, {
      method: 'POST',
      body: formData
    });
    return handleJsonResponse(res, `/agent/upload-document/${applicationId}`);
  },

  async createDocket(data: { institution_name: string; category?: string; state?: string; city?: string; survey_no?: string }): Promise<{
    id: number;
    application_number: string;
    institution_name: string;
    category: string;
    status: string;
  }> {
    const res = await fetchWithAuth('/agent/create-application', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return handleJsonResponse(res, '/agent/create-application');
  },

  async getApplicationDocuments(applicationId: number): Promise<Array<{
    id: number;
    doc_type: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    extracted_fields: any;
    uploaded_at: string | null;
  }>> {
    const res = await fetchWithAuth(`/agent/documents/${applicationId}`);
    return handleJsonResponse(res, `/agent/documents/${applicationId}`);
  }
};
