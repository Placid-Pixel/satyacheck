import { Application, Finding, Rule, AuditBlock, EvaluationMetrics, User, AgentVerificationReport, GeminiStatusResponse, AgentTraceStep } from './types';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE as string) || '/api';

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let token = localStorage.getItem('satyacheck_token');
  if (!token) {
    try {
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
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

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    try {
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'scrutiny_officer', password: 'officer123' })
      });
      if (loginRes.ok) {
        const authData = await loginRes.json();
        localStorage.setItem('satyacheck_token', authData.access_token);
        const retryHeaders: HeadersInit = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authData.access_token}`,
          ...(options.headers || {})
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
  async login(username: string, password: string): Promise<{ access_token: string; role: string; user_id: number; username: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error('Invalid credentials');
    const data = await res.json();
    localStorage.setItem('satyacheck_token', data.access_token);
    return data;
  },

  async getMe(): Promise<User> {
    const res = await fetchWithAuth(`${API_BASE}/auth/me`);
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
  },

  async getApplications(status?: string, category?: string, risk_level?: string): Promise<Application[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    if (risk_level) params.append('risk_level', risk_level);

    const res = await fetchWithAuth(`${API_BASE}/applications?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch applications');
    return res.json();
  },

  async getApplication(id: number): Promise<Application> {
    const res = await fetchWithAuth(`${API_BASE}/applications/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch application details (HTTP ${res.status})`);
    return res.json();
  },

  async findApplicationByNumber(applicationNumber: string): Promise<Application | undefined> {
    const apps = await this.getApplications();
    return apps.find((a) => a.application_number === applicationNumber);
  },

  async runPreCheck(payload: any): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/applications/pre-check`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to run self-check');
    return res.json();
  },

  async exportReport(id: number): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/applications/${id}/export-report`);
    if (!res.ok) throw new Error('Failed to export report');
    return res.json();
  },

  async executeFindingAction(findingId: number, action: string, justification: string): Promise<Finding> {
    const res = await fetchWithAuth(`${API_BASE}/findings/${findingId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, justification })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to execute officer action');
    }
    return res.json();
  },

  async getRules(): Promise<Rule[]> {
    const res = await fetchWithAuth(`${API_BASE}/rules`);
    if (!res.ok) throw new Error('Failed to fetch rules');
    return res.json();
  },

  async simulateRuleImpact(ruleCode: string, newParamValue: any): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/rules/simulate`, {
      method: 'POST',
      body: JSON.stringify({ rule_code: ruleCode, new_parameter_value: newParamValue })
    });
    return res.json();
  },

  async getAdapters(): Promise<any[]> {
    const res = await fetchWithAuth(`${API_BASE}/verification/adapters`);
    return res.json();
  },

  async triggerVerification(docId: number): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/verification/verify-document/${docId}`, {
      method: 'POST'
    });
    return res.json();
  },

  async getTimeline(appId: number): Promise<any[]> {
    const res = await fetchWithAuth(`${API_BASE}/verification/timeline/${appId}`);
    return res.json();
  },

  async analyzeInfraPhoto(docId: number): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/infrastructure/analyze-photo/${docId}`, {
      method: 'POST'
    });
    return res.json();
  },

  async getKnowledgeGraph(appId: number): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/graph/${appId}`);
    return res.json();
  },

  async getAuditTrail(): Promise<AuditBlock[]> {
    const res = await fetchWithAuth(`${API_BASE}/audit`);
    return res.json();
  },

  async verifyAuditIntegrity(): Promise<{ is_valid: boolean; total_blocks: number; message: string; tampered_blocks: number[] }> {
    const res = await fetchWithAuth(`${API_BASE}/audit/verify`, {
      method: 'POST'
    });
    return res.json();
  },

  async getEvaluationMetrics(): Promise<EvaluationMetrics> {
    const res = await fetchWithAuth(`${API_BASE}/evaluation/metrics`);
    return res.json();
  },

  async runEvaluationBenchmark(): Promise<EvaluationMetrics> {
    const res = await fetchWithAuth(`${API_BASE}/evaluation/run`, {
      method: 'POST'
    });
    return res.json();
  },

  // SatyaCheck AI Verification Agent APIs
  async getGeminiStatus(): Promise<GeminiStatusResponse> {
    const res = await fetchWithAuth(`${API_BASE}/agent/gemini-status`);
    return res.json();
  },

  async runAgentVerification(
    applicationId: number,
    mode: 'auto' | 'gemini' | 'offline' = 'auto',
    scrutinyFocus?: string
  ): Promise<AgentVerificationReport> {
    const res = await fetchWithAuth(`${API_BASE}/agent/verify/${applicationId}`, {
      method: 'POST',
      body: JSON.stringify({ mode, scrutiny_focus: scrutinyFocus })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Agent verification failed' }));
      throw new Error(err.detail || 'Agent verification failed');
    }
    return res.json();
  },

  async getAgentStatus(executionId: string): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/agent/status/${executionId}`);
    return res.json();
  },

  async getAgentTrace(executionId: string): Promise<{ execution_id: string; total_steps: number; trace: AgentTraceStep[] }> {
    const res = await fetchWithAuth(`${API_BASE}/agent/trace/${executionId}`);
    return res.json();
  },

  async getAgentReport(executionId: string): Promise<AgentVerificationReport> {
    const res = await fetchWithAuth(`${API_BASE}/agent/report/${executionId}`);
    return res.json();
  },

  async getAgentHistory(applicationId: number): Promise<any[]> {
    const res = await fetchWithAuth(`${API_BASE}/agent/history/${applicationId}`);
    return res.json();
  }
};
