<script setup lang="ts">
import Button from 'primevue/button';
import Select from 'primevue/select';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';
import {
  asignarSupervisor,
  buscarSupervisoresDisponibles,
  obtenerSupervisores,
  retirarSupervisor,
  type SupervisorDisponible,
  type SupervisorProyecto,
} from '@/api/supervisores';
import { mensajeDeError } from '@/utils/errores';
import { formatoFecha } from '@/utils/formato';

/**
 * Quién supervisa el proyecto. Un supervisor puede estar en muchos proyectos y un proyecto en varios supervisores;
 * cada supervisor solo ve los proyectos donde está. El Administrador asigna y retira.
 */
const props = defineProps<{ proyectoId: string; editable: boolean }>();

const toast = useToast();
const confirm = useConfirm();

const supervisores = ref<SupervisorProyecto[]>([]);
const disponibles = ref<SupervisorDisponible[]>([]);
const seleccionado = ref<string | null>(null);
const cargando = ref(true);
const asignando = ref(false);

async function cargar() {
  try {
    supervisores.value = await obtenerSupervisores(props.proyectoId);
    disponibles.value = props.editable ? await buscarSupervisoresDisponibles(props.proyectoId) : [];
  } catch (e) {
    toast.add({ severity: 'error', summary: 'No se pudo cargar la supervisión', detail: mensajeDeError(e), life: 6000 });
  } finally {
    cargando.value = false;
  }
}

async function asignar() {
  if (!seleccionado.value) return;
  asignando.value = true;
  try {
    const s = await asignarSupervisor(props.proyectoId, seleccionado.value);
    toast.add({ severity: 'success', summary: 'Supervisor asignado', detail: `${s.nombre} supervisa ahora este proyecto.`, life: 4000 });
    seleccionado.value = null;
    await cargar();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'No se pudo asignar', detail: mensajeDeError(e), life: 6000 });
  } finally {
    asignando.value = false;
  }
}

function pedirRetiro(s: SupervisorProyecto) {
  confirm.require({
    header: 'Quitar supervisor',
    message: `¿Quitar a ${s.nombre} de este proyecto? Dejará de verlo y de supervisarlo.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancelar',
    acceptLabel: 'Quitar',
    acceptProps: { severity: 'danger' },
    accept: async () => {
      try {
        await retirarSupervisor(props.proyectoId, s.id);
        toast.add({ severity: 'success', summary: 'Supervisor retirado', detail: `${s.nombre} ya no supervisa este proyecto.`, life: 4000 });
        await cargar();
      } catch (e) {
        toast.add({ severity: 'error', summary: 'No se pudo retirar', detail: mensajeDeError(e), life: 6000 });
      }
    },
  });
}

onMounted(cargar);
</script>

<template>
  <section
    class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5"
    data-test="seccion-supervisores"
  >
    <h2 class="text-base font-semibold text-slate-800">
      Supervisión
    </h2>
    <p class="mt-1 text-sm text-slate-500">
      Quienes supervisan este proyecto. Cada supervisor solo ve los proyectos donde está asignado.
    </p>

    <div
      v-if="editable"
      class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
      data-test="asignar-supervisor"
    >
      <div class="min-w-0 flex-1">
        <label
          for="elegir-supervisor"
          class="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Agregar supervisor
        </label>
        <Select
          v-model="seleccionado"
          input-id="elegir-supervisor"
          :options="disponibles"
          option-label="nombre"
          option-value="id"
          :placeholder="disponibles.length ? 'Elige un supervisor' : 'No quedan supervisores por asignar'"
          :disabled="asignando || disponibles.length === 0"
          fluid
          data-test="select-supervisor"
        />
      </div>
      <Button
        label="Asignar"
        icon="pi pi-user-plus"
        :loading="asignando"
        :disabled="!seleccionado"
        data-test="btn-asignar-supervisor"
        @click="asignar"
      />
    </div>

    <p
      v-if="!cargando && supervisores.length === 0"
      class="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-500"
      data-test="sin-supervisores"
    >
      Este proyecto todavía no tiene supervisor.
    </p>
    <ul
      v-else
      class="mt-5 divide-y divide-slate-100"
    >
      <li
        v-for="s in supervisores"
        :key="s.id"
        class="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
        data-test="supervisor"
      >
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-800">
            {{ s.nombre }}
          </p>
          <p class="text-xs text-slate-500">
            {{ s.email }} · desde el {{ formatoFecha(s.fechaAsignacion) }}
          </p>
        </div>
        <Button
          v-if="editable"
          icon="pi pi-trash"
          severity="danger"
          text
          rounded
          :aria-label="`Quitar a ${s.nombre}`"
          data-test="btn-quitar-supervisor"
          @click="pedirRetiro(s)"
        />
      </li>
    </ul>
  </section>
</template>