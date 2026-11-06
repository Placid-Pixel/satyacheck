import { Application, Finding, Rule, AuditBlock, EvaluationMetrics, User, AgentVerificationReport, GeminiStatusResponse, AgentTraceStep } from './types';

export function getApiBaseUrl(): string {
  const custom = localStorage.getItem('satyacheck_custom_backend_url');
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, '');
  }
  const envUrl = ((import.meta as any).env?.VITE_API_BASE as string) || ((import.meta as any).env?.VITE_API_URL as string);
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
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

function resolveUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

async function handleJsonResponse(res: Response, url: string): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(
      `Backend is not reachable at ${getApiBaseUrl()}. The server returned HTML instead of API data. If using a deployed frontend, please verify your deployed backend URL in Connection Settings.`
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
  const url = resolveUrl(path);
  let token = localStorage.getItem('satyacheck_token');
  
  if (!token) {
    try {
      const loginUrl = resolveUrl('/auth/login');
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
      console.warn('Auto-login failed:', e);
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
      `Network error connecting to backend at ${getApiBaseUrl()}. Check that FastAPI is running and CORS allows your origin: ${netErr.message || netErr}`
    );
  }

  if (res.status === 401) {
    try {
      const loginUrl = resolveUrl('/auth/login');
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

  async checkHealth(): Promise<{ ok: boolean; status?: string; version?: string; error?: string; url: string }> {
    const targetUrl = resolveUrl('/health');
    try {
      const res = await fetch(targetUrl, { method: 'GET' });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || contentType.includes('text/html')) {
        return { ok: false, error: `Invalid response (${res.status})`, url: targetUrl };
      }
      const data = await res.json();
      return { ok: true, status: data.status, version: data.version, url: targetUrl };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Connection refused', url: targetUrl };
    }
  },

  async login(username: string, password: string): Promise<{ access_token: string; role: string; user_id: number; username: string }> {
    const url = resolveUrl('/auth/login');
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
