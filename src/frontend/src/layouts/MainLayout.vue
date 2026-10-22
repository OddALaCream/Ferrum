<script setup lang="ts">
import Avatar from 'primevue/avatar';
import Menu from 'primevue/menu';
import type { MenuItem } from 'primevue/menuitem';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MODULOS } from '@/router/modulos';
import { ROLES, useAuthStore } from '@/stores/auth';

const CLAVE_COLAPSADO = 'sgp.sidebar.colapsado';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

/** Solo escritorio (lg+): sidebar reducido a iconos. */
const colapsado = ref(localStorage.getItem(CLAVE_COLAPSADO) === '1');
/** Solo móvil (< lg): sidebar como panel superpuesto. */
const menuMovilAbierto = ref(false);
const menuPerfil = ref<InstanceType<typeof Menu>>();

const iniciales = computed(() =>
  auth.nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
);

const opcionesPerfil = computed<MenuItem[]>(() => [
  {
    label: 'Ver como (rol simulado)',
    items: ROLES.map((r) => ({
      label: r.label,
      icon: r.value === auth.role ? 'pi pi-check' : 'pi pi-fw',
      command: () => auth.setRole(r.value),
    })),
  },
]);

function alternarColapsado() {
  colapsado.value = !colapsado.value;
  localStorage.setItem(CLAVE_COLAPSADO, colapsado.value ? '1' : '0');
}

function cerrarConEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') menuMovilAbierto.value = false;
}

watch(() => route.fullPath, () => (menuMovilAbierto.value = false));

// Al cambiar de rol, salir del módulo actual si el nuevo rol ya no tiene acceso
watch(
  () => auth.role,
  () => {
    if (!auth.tieneAcceso(route.meta.roles)) router.replace({ name: 'dashboard' });
  },
);

onMounted(() => window.addEventListener('keydown', cerrarConEscape));
onBeforeUnmount(() => window.removeEventListener('keydown', cerrarConEscape));
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-slate-50">
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-300"
      leave-to-class="opacity-0"
    >
      <div
        v-if="menuMovilAbierto"
        class="fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm lg:hidden"
        aria-hidden="true"
        @click="menuMovilAbierto = false"
      />
    </Transition>

    <aside
      id="sidebar"
      :class="[
        'fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col bg-slate-900 transition-all duration-300 ease-in-out',
        'lg:static lg:translate-x-0',
        menuMovilAbierto ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        colapsado && 'lg:w-20',
      ]"
    >
      <div class="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold tracking-tight text-white shadow-sm shadow-black/30"
        >
          SF
        </span>
        <div
          class="min-w-0 flex-1 leading-tight"
          :class="{ 'lg:hidden': colapsado }"
        >
          <p class="text-sm font-semibold text-white">
            Serfamilia
          </p>
          <p class="text-xs text-slate-400">
            Gestión de Proyectos
          </p>
        </div>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Cerrar menú"
          @click="menuMovilAbierto = false"
        >
          <i class="pi pi-times" />
        </button>
      </div>

      <nav
        class="flex-1 overflow-y-auto px-3 py-5 [scrollbar-color:rgb(255_255_255/0.15)_transparent] [scrollbar-width:thin]"
        aria-label="Módulos"
      >
        <p
          class="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
          :class="{ 'lg:hidden': colapsado }"
        >
          Módulos
        </p>
        <ul class="flex flex-col gap-1">
          <template
            v-for="modulo in MODULOS"
            :key="modulo.name"
          >
            <li
              v-if="auth.tieneAcceso(modulo.roles)"
              :data-test="`menu-${modulo.name}`"
            >
              <RouterLink
                v-slot="{ href, navigate, isActive }"
                :to="{ name: modulo.name }"
                custom
              >
                <a
                  v-tooltip.right="{ value: modulo.titulo, disabled: !colapsado || menuMovilAbierto }"
                  :href="href"
                  :aria-label="modulo.titulo"
                  :aria-current="isActive ? 'page' : undefined"
                  :class="[
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    colapsado && 'lg:justify-center lg:px-0',
                    isActive
                      ? 'bg-primary text-white shadow-sm shadow-black/30'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  ]"
                  @click="navigate"
                >
                  <i
                    :class="[
                      modulo.icono,
                      'w-5 text-center text-base',
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-white',
                    ]"
                  />
                  <span :class="{ 'lg:hidden': colapsado }">{{ modulo.titulo }}</span>
                </a>
              </RouterLink>
            </li>
          </template>
        </ul>
      </nav>

      <div class="hidden shrink-0 border-t border-white/10 p-3 lg:block">
        <button
          type="button"
          :class="[
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white',
            colapsado && 'justify-center px-0',
          ]"
          :aria-label="colapsado ? 'Expandir menú' : 'Colapsar menú'"
          :aria-expanded="!colapsado"
          aria-controls="sidebar"
          @click="alternarColapsado"
        >
          <i :class="['pi w-5 text-center', colapsado ? 'pi-angle-double-right' : 'pi-angle-double-left']" />
          <span v-if="!colapsado">Colapsar menú</span>
        </button>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="relative z-20 flex h-16 shrink-0 items-center gap-3 bg-white px-4 shadow-sm sm:px-6">
        <button
          type="button"
          class="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 lg:hidden"
          aria-label="Abrir menú"
          :aria-expanded="menuMovilAbierto"
          aria-controls="sidebar"
          @click="menuMovilAbierto = true"
        >
          <i class="pi pi-bars text-lg" />
        </button>

        <nav
          class="flex min-w-0 items-center gap-2 text-sm text-slate-500"
          aria-label="Ruta de navegación"
        >
          <i class="pi pi-home text-xs" />
          <span class="hidden sm:inline">SGP Serfamilia</span>
          <i class="pi pi-angle-right hidden text-xs text-slate-300 sm:inline" />
          <span class="truncate font-medium text-slate-700">{{ route.meta.titulo }}</span>
        </nav>

        <div class="ml-auto">
          <button
            type="button"
            class="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:rounded-lg sm:pr-3"
            :aria-label="`Perfil de ${auth.nombre} (${auth.rolLabel})`"
            aria-haspopup="menu"
            aria-controls="menu-perfil"
            data-test="perfil"
            @click="menuPerfil?.toggle($event)"
          >
            <Avatar
              :label="iniciales"
              shape="circle"
              class="bg-primary! text-xs! font-semibold text-white!"
            />
            <span class="hidden text-left leading-tight sm:block">
              <span class="block text-sm font-medium text-slate-800">{{ auth.nombre }}</span>
              <span
                class="block text-xs text-slate-500"
                data-test="rol-actual"
              >{{ auth.rolLabel }}</span>
            </span>
            <i class="pi pi-chevron-down hidden text-xs text-slate-400 sm:inline" />
          </button>
          <Menu
            id="menu-perfil"
            ref="menuPerfil"
            :model="opcionesPerfil"
            popup
            class="mt-1 min-w-56"
          />
        </div>
      </header>

      <main class="flex-1 overflow-y-auto bg-slate-50">
        <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div class="mb-6">
            <h1 class="text-2xl font-semibold text-slate-800">
              {{ route.meta.titulo }}
            </h1>
            <p
              v-if="route.meta.descripcion"
              class="mt-1 text-sm text-slate-500"
            >
              {{ route.meta.descripcion }}
            </p>
          </div>
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>
