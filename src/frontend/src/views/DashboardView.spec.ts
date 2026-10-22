import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import DashboardView from './DashboardView.vue';

vi.mock('@/api/health', () => ({ getHealth: vi.fn().mockResolvedValue({ status: 'ok' }) }));

describe('DashboardView', () => {
  it('muestra la API como conectada cuando /health responde ok', async () => {
    const wrapper = mount(DashboardView, { global: { plugins: [createPinia()], stubs: { RouterLink: true } } });
    await new Promise((r) => setTimeout(r));
    expect(wrapper.get('[data-test="api-status"]').text()).toBe('conectada');
  });
});
