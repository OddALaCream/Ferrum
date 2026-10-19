import { http } from './http';

export interface HealthResponse {
  status: 'ok' | 'error';
  info?: Record<string, { status: string }>;
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await http.get<HealthResponse>('/health');
  return data;
}
