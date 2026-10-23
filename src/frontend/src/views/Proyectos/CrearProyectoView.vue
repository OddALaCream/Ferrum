<script setup lang="ts">
import { isAxiosError } from 'axios';
import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { crearProyecto, type ProblemDetails } from '@/api/proyectos';

const CODIGO_MAX = 30;
const NOMBRE_MAX = 250;

interface FormProyecto {
  codigo: string;
  nombre: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
}

const vacio = (): FormProyecto => ({
  codigo: '',
  nombre: '',
  fechaInicio: null,
  fechaFin: null,
});

const router = useRouter();
const toast = useToast();

const form = reactive<FormProyecto>(vacio());
const guardando = ref(false);
/** Los errores se muestran después del primer intento de guardar. */
const enviado = ref(false);
const errorCodigoServidor = ref<string | null>(null);

const errores = computed(() => {
  const e: Partial<Record<keyof FormProyecto, string>> = {};
  const codigo = form.codigo.trim();
  const nombre = form.nombre.trim();

  if (!codigo) e.codigo = 'El código es obligatorio.';
  else if (codigo.length > CODIGO_MAX) e.codigo = `Máximo ${CODIGO_MAX} caracteres.`;
  else if (errorCodigoServidor.value) e.codigo = errorCodigoServidor.value;

  if (!nombre) e.nombre = 'El nombre es obligatorio.';
  else if (nombre.length > NOMBRE_MAX) e.nombre = `Máximo ${NOMBRE_MAX} caracteres.`;

  if (!form.fechaInicio) e.fechaInicio = 'La fecha de inicio es obligatoria.';
  if (!form.fechaFin) e.fechaFin = 'La fecha de fin es obligatoria.';
  else if (form.fechaInicio && form.fechaFin < form.fechaInicio) {
    e.fechaFin = 'La fecha de fin no puede ser anterior a la de inicio.';
  }
  return e;
});

const visible = (campo: keyof FormProyecto) => (enviado.value ? errores.value[campo] : undefined);

// Un 409 deja de aplicar en cuanto el usuario modifica el código
watch(
  () => form.codigo,
  () => (errorCodigoServidor.value = null),
);

/** Fecha local a `YYYY-MM-DD` sin pasar por UTC (toISOString podría restar un día). */
function aFechaIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

async function guardar() {
  enviado.value = true;
  if (Object.keys(errores.value).length > 0) return;

  guardando.value = true;
  try {
    const proyecto = await crearProyecto({
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      fechaInicio: aFechaIso(form.fechaInicio!),
      fechaFin: aFechaIso(form.fechaFin!),
    });
    toast.add({
      severity: 'success',
      summary: 'Proyecto registrado',
      detail: `${proyecto.codigo} · ${proyecto.nombre}`,
      life: 4000,
    });
    Object.assign(form, vacio());
    enviado.value = false;
  } catch (e) {
    // Rehabilitar los campos antes de manejar el error para poder devolver el foco al código
    guardando.value = false;
    await nextTick();
    manejarError(e);
  } finally {
    guardando.value = false;
  }
}

function manejarError(e: unknown) {
  const problema = isAxiosError<ProblemDetails>(e) ? e.response?.data : undefined;
  const detalle = Array.isArray(problema?.detail) ? problema.detail.join(' ') : problema?.detail;

  // CP-01: código de proyecto duplicado
  if (isAxiosError(e) && e.response?.status === 409) {
    errorCodigoServidor.value = detalle ?? 'El código ya está registrado.';
    toast.add({ severity: 'error', summary: 'Código duplicado', detail: errorCodigoServidor.value, life: 6000 });
    document.getElementById('codigo')?.focus();
    return;
  }
  toast.add({
    severity: 'error',
    summary: 'No se pudo registrar el proyecto',
    detail: detalle ?? 'Inténtelo de nuevo en unos minutos.',
    life: 6000,
  });
}

function cancelar() {
  if (window.history.state?.back) router.back();
  else router.push({ name: 'dashboard' });
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <form
      class="rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5"
      novalidate
      data-test="form-proyecto"
      @submit.prevent="guardar"
    >
      <div class="border-b border-slate-100 px-6 py-5">
        <h1 class="text-2xl font-semibold text-slate-800">
          Registrar proyecto
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          Complete los datos generales del proyecto. Los campos marcados con
          <span class="text-primary">*</span> son obligatorios.
        </p>
      </div>

      <div class="grid gap-x-6 gap-y-5 px-6 py-6 sm:grid-cols-2">
        <div>
          <label
            for="codigo"
            class="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Código único <span class="text-primary">*</span>
          </label>
          <InputText
            id="codigo"
            v-model="form.codigo"
            :maxlength="CODIGO_MAX"
            :invalid="!!visible('codigo')"
            :disabled="guardando"
            placeholder="Ej. PRY-2026-001"
            autocomplete="off"
            fluid
            aria-describedby="codigo-ayuda"
          />
          <div
            id="codigo-ayuda"
            class="mt-1 flex justify-between gap-2 text-xs"
          >
            <Message
              v-if="visible('codigo')"
              severity="error"
              size="small"
              variant="simple"
              data-test="error-codigo"
            >
              {{ visible('codigo') }}
            </Message>
            <span class="ml-auto shrink-0 text-slate-400">{{ form.codigo.length }}/{{ CODIGO_MAX }}</span>
          </div>
        </div>

        <div class="sm:col-span-2">
          <label
            for="nombre"
            class="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Nombre del proyecto <span class="text-primary">*</span>
          </label>
          <InputText
            id="nombre"
            v-model="form.nombre"
            :maxlength="NOMBRE_MAX"
            :invalid="!!visible('nombre')"
            :disabled="guardando"
            placeholder="Nombre completo del proyecto"
            fluid
          />
          <Message
            v-if="visible('nombre')"
            class="mt-1"
            severity="error"
            size="small"
            variant="simple"
          >
            {{ visible('nombre') }}
          </Message>
        </div>

        <div>
          <label
            for="fecha-inicio"
            class="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Fecha de inicio <span class="text-primary">*</span>
          </label>
          <DatePicker
            v-model="form.fechaInicio"
            input-id="fecha-inicio"
            date-format="dd/mm/yy"
            placeholder="dd/mm/aaaa"
            :max-date="form.fechaFin ?? undefined"
            :invalid="!!visible('fechaInicio')"
            :disabled="guardando"
            show-icon
            icon-display="input"
            fluid
          />
          <Message
            v-if="visible('fechaInicio')"
            class="mt-1"
            severity="error"
            size="small"
            variant="simple"
          >
            {{ visible('fechaInicio') }}
          </Message>
        </div>

        <div>
          <label
            for="fecha-fin"
            class="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Fecha de fin <span class="text-primary">*</span>
          </label>
          <DatePicker
            v-model="form.fechaFin"
            input-id="fecha-fin"
            date-format="dd/mm/yy"
            placeholder="dd/mm/aaaa"
            :min-date="form.fechaInicio ?? undefined"
            :invalid="!!visible('fechaFin')"
            :disabled="guardando"
            show-icon
            icon-display="input"
            fluid
          />
          <Message
            v-if="visible('fechaFin')"
            class="mt-1"
            severity="error"
            size="small"
            variant="simple"
            data-test="error-fecha-fin"
          >
            {{ visible('fechaFin') }}
          </Message>
        </div>
      </div>

      <div
        class="flex flex-col-reverse gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:justify-end"
      >
        <Button
          type="button"
          label="Cancelar"
          severity="secondary"
          outlined
          :disabled="guardando"
          @click="cancelar"
        />
        <Button
          type="submit"
          label="Guardar Proyecto"
          icon="pi pi-check"
          :loading="guardando"
          data-test="guardar"
        />
      </div>
    </form>
  </div>
</template>