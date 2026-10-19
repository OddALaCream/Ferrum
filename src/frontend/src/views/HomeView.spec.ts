import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import HomeView from './HomeView.vue';

vi.mock('@/api/health', () => ({ getHealth: vi.fn().mockResolvedValue({ status: 'ok' }) }));

describe('HomeView', () => {
  it('muestra la API como conectada cuando /health responde ok', async () => {
    const wrapper = mount(HomeView, { global: { plugins: [createPinia()] } });
    await new Promise((r) => setTimeout(r));
    expect(wrapper.get('[data-test="api-status"]').text()).toBe('conectada');
  });
});
