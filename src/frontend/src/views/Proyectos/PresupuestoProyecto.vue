<script setup lang="ts">
import { isAxiosError } from 'axios';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import Message from 'primevue/message';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';
import {
  MONEDAS,
  motivoMontoInvalido,
  registrarPresupuesto,
  type Moneda,
  type ProblemDetails,
  type Proyecto,
} from '@/api/proyectos';

/** RF-02 / CP-02: muestra y registra el presupuesto total aprobado del proyecto. */
const props = defineProps<{ proyecto: Proyecto; editable: boolean }>();
const emit = defineEmits<{ actualizado: [proyecto: Proyecto] }>();

const toast = useToast();

const NOMBRES_MONEDA: Record<Moneda, string> = {
  BOB: 'Bolivianos',
  USD: 'Dólares estadounidenses',
  EUR: 'Euros',
};
const opcionesMoneda = MONEDAS.map((m) => ({ value: m, label: `${m} · ${NOMBRES_MONEDA[m]}` }));

const monto = ref<number | null>(null);
const moneda = ref<Moneda>('BOB');
const guardando = ref(false);
/** El error del monto se muestra tras el primer intento de guardar o si lo devuelve el servidor. */
const errorMonto = ref<string | null>(null);

function sincronizar() {
  monto.value = Number(props.proyecto.presupuestoTotal);
  moneda.value = props.proyecto.moneda;
  errorMonto.value = null;
}

watch(() => [props.proyecto.presupuestoTotal, props.proyecto.moneda], sincronizar, { immediate: true });

/** InputNumber trabaja con `number`; la API recibe texto con dos decimales para no perder precisión. */
const montoTexto = computed(() => (monto.value === null ? '' : monto.value.toFixed(2)));

const sinCambios = computed(
  () =>
    montoTexto.value === Number(props.proyecto.presupuestoTotal).toFixed(2) &&
    moneda.value === props.proyecto.moneda,
);

const montoFormateado = computed(() =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: props.proyecto.moneda }).format(
    Number(props.proyecto.presupuestoTotal),
  ),
);

watch([monto, moneda], () => (errorMonto.value = null));

function detalleDe(e: unknown): string | undefined {
  const detail = isAxiosError<ProblemDetails>(e) ? e.response?.data?.detail : undefined;
  return Array.isArray(detail) ? detail.join(' ') : detail;
}

async function guardar() {
  const motivo = motivoMontoInvalido(montoTexto.value);
  if (motivo) {
    errorMonto.value = motivo;
    return;
  }

  guardando.value = true;
  try {
    const actualizado = await registrarPresupuesto(props.proyecto.id, { monto: montoTexto.value, moneda: moneda.value });
    emit('actualizado', actualizado);
    toast.add({
      severity: 'success',
      summary: 'Presupuesto registrado',
      detail: 'El presupuesto total del proyecto se guardó correctamente.',
      life: 4000,
    });
  } catch (e) {
    const detalle = detalleDe(e);
    if (isAxiosError(e) && e.response?.status === 400 && detalle) {
      errorMonto.value = detalle;
    } else {
      toast.add({
        severity: 'error',
        summary: 'No se pudo registrar el presupuesto',
        detail: detalle ?? 'Inténtelo de nuevo.',
        life: 6000,
      });
    }
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <section
    class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5"
    data-test="seccion-presupuesto"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-slate-800">
          Presupuesto
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          Monto total aprobado por el financiador; base para controlar gastos y tramos.
        </p>
      </div>
      <div class="text-right">
        <p class="text-xs font-medium uppercase tracking-wider text-slate-500">
          Presupuesto total
        </p>
        <p
          class="mt-1 text-xl font-semibold tabular-nums text-slate-800"
          data-test="monto-actual"
        >
          {{ montoFormateado }}
        </p>
      </div>
    </div>

    <form
      v-if="editable"
      class="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-[1fr_16rem_auto] sm:items-start"
      novalidate
      data-test="form-presupuesto"
      @submit.prevent="guardar"
    >
      <div>
        <label
          for="monto-presupuesto"
          class="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Monto <span class="text-primary">*</span>
        </label>
        <InputNumber
          v-model="monto"
          input-id="monto-presupuesto"
          mode="decimal"
          locale="es-BO"
          :min-fraction-digits="2"
          :max-fraction-digits="2"
          placeholder="0,00"
          :invalid="!!errorMonto"
          :disabled="guardando"
          fluid
          data-test="input-monto"
        />
        <Message
          v-if="errorMonto"
          class="mt-1"
          severity="error"
          size="small"
          variant="simple"
          data-test="error-monto"
        >
          {{ errorMonto }}
        </Message>
      </div>

      <div>
        <label
          id="moneda-label"
          for="moneda-presupuesto"
          class="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Moneda <span class="text-primary">*</span>
        </label>
        <Select
          v-model="moneda"
          input-id="moneda-presupuesto"
          aria-labelledby="moneda-label"
          :options="opcionesMoneda"
          option-label="label"
          option-value="value"
          :disabled="guardando"
          fluid
          data-test="select-moneda"
        />
      </div>

      <Button
        type="submit"
        label="Guardar presupuesto"
        icon="pi pi-save"
        class="sm:mt-7"
        :loading="guardando"
        :disabled="sinCambios"
        data-test="btn-guardar-presupuesto"
      />
    </form>
  </section>
</template>
