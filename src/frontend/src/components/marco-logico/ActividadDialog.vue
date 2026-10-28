<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import Textarea from 'primevue/textarea';
import { computed, reactive, ref, watch } from 'vue';
import type { TecnicoProyecto } from '@/api/equipo';
import { crearActividad, type TipoCronograma } from '@/api/marcoLogico';
import { formatoFecha } from '@/utils/formato';
import { mensajeDeError } from '@/utils/errores';

const props = defineProps<{
  proyectoId: string;
  resultadoId: string | null;
  resultadoCodigo: string;
  sugerencia: string;
  equipo: TecnicoProyecto[];
  /** Periodo del proyecto: las fechas de la actividad deben quedar dentro. */
  periodo: { inicio: string; fin: string };
}>();
const visible = defineModel<boolean>('visible', { required: true });
const emit = defineEmits<{ guardado: [] }>();

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS = [
  { value: 'CONTINUO', label: 'Continua' },
  { value: 'DISCRETO', label: 'Discreta (por sesiones)' },
];

const form = reactive({
  codigo: '',
  nombre: '',
  descripcion: '',
  tipo: 'CONTINUO' as TipoCronograma,
  fechaInicio: '',
  fechaFin: '',
  responsableId: null as string | null,
  meta: null as number | null,
  unidadMeta: '',
  fuentes: '',
  sesionesTexto: '',
});
const gen = reactive({ primera: '', cadaDias: 7 as number | null, cantidad: 4 as number | null });
const enviado = ref(false);
const guardando = ref(false);
const errorServidor = ref<string | null>(null);

watch(visible, (abierto) => {
  if (!abierto) return;
  Object.assign(form, {
    codigo: props.sugerencia, nombre: '', descripcion: '', tipo: 'CONTINUO', fechaInicio: props.periodo.inicio,
    fechaFin: props.periodo.fin, responsableId: null, meta: null, unidadMeta: '', fuentes: '', sesionesTexto: '',
  });
  Object.assign(gen, { primera: '', cadaDias: 7, cantidad: 4 });
  enviado.value = false;
  errorServidor.value = null;
});

const sesiones = computed(() =>
  [...new Set(form.sesionesTexto.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))].sort(),
);

/** Genera las fechas de las sesiones: una primera fecha y cada cuántos días se repite. */
function generar() {
  if (!FECHA.test(gen.primera) || !gen.cadaDias || !gen.cantidad) return;
  const [a, m, d] = gen.primera.split('-').map(Number);
  const fechas: string[] = [];
  for (let i = 0; i < Math.min(gen.cantidad, 100); i++) {
    const f = new Date(a, m - 1, d + i * gen.cadaDias);
    fechas.push(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`);
  }
  form.sesionesTexto = fechas.join('\n');
}

const errores = computed(() => {
  const e: Partial<Record<'codigo' | 'nombre' | 'fechas' | 'sesiones', string>> = {};
  if (!form.codigo.trim()) e.codigo = 'Ingresa el código, por ejemplo A.1.1.';
  if (!form.nombre.trim()) e.nombre = 'Ponle un nombre corto a la actividad.';
  if (!FECHA.test(form.fechaInicio) || !FECHA.test(form.fechaFin)) e.fechas = 'Indica la fecha de inicio y la de fin.';
  else if (form.fechaFin < form.fechaInicio) e.fechas = 'La fecha de fin no puede ser anterior a la de inicio.';
  else if (form.fechaInicio < props.periodo.inicio || form.fechaFin > props.periodo.fin) {
    e.fechas = `Las fechas deben estar dentro del periodo del proyecto (${formatoFecha(props.periodo.inicio)} a ${formatoFecha(props.periodo.fin)}).`;
  }
  if (form.tipo === 'DISCRETO') {
    const mal = sesiones.value.find((s) => !FECHA.test(s));
    const fuera = sesiones.value.find((s) => s < form.fechaInicio || s > form.fechaFin);
    if (mal) e.sesiones = `"${mal}" no tiene el formato AAAA-MM-DD.`;
    else if (fuera) e.sesiones = `La sesión del ${fuera} está fuera del cronograma de la actividad.`;
  }
  return e;
});

async function guardar() {
  enviado.value = true;
  errorServidor.value = null;
  if (Object.keys(errores.value).length > 0 || !props.resultadoId) return;
  guardando.value = true;
  try {
    await crearActividad(props.proyectoId, props.resultadoId, {
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      ...(form.descripcion.trim() ? { descripcion: form.descripcion.trim() } : {}),
      tipoCronograma: form.tipo,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      ...(form.responsableId ? { responsableId: form.responsableId } : {}),
      ...(form.meta === null ? {} : { metaCuantitativa: form.meta }),
      ...(form.unidadMeta.trim() ? { unidadMeta: form.unidadMeta.trim() } : {}),
      ...(form.fuentes.trim() ? { fuentesVerificacion: form.fuentes.trim() } : {}),
      ...(form.tipo === 'DISCRETO' && sesiones.value.length ? { sesiones: sesiones.value } : {}),
    });
    emit('guardado');
    visible.value = false;
  } catch (e) {
    errorServidor.value = mensajeDeError(e, 'No se pudo guardar la actividad.');
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="`Nueva actividad en ${resultadoCodigo}`"
    class="w-full max-w-2xl"
    :closable="!guardando"
  >
    <form
      class="grid gap-4 sm:grid-cols-2"
      novalidate
      data-test="form-actividad"
      @submit.prevent="guardar"
    >
      <Message
        v-if="errorServidor"
        severity="error"
        size="small"
        class="sm:col-span-2"
        data-test="error-servidor"
      >
        {{ errorServidor }}
      </Message>

      <div class="flex flex-col gap-1.5">
        <label
          for="act-codigo"
          class="text-sm font-medium text-slate-700"
        >Código</label>
        <InputText
          id="act-codigo"
          v-model="form.codigo"
          maxlength="20"
          :invalid="enviado && !!errores.codigo"
          :disabled="guardando"
        />
        <Message
          v-if="enviado && errores.codigo"
          severity="error"
          size="small"
          variant="simple"
        >
          {{ errores.codigo }}
        </Message>
      </div>
      <div class="flex flex-col gap-1.5">
        <label
          for="act-nombre"
          class="text-sm font-medium text-slate-700"
        >Nombre</label>
        <InputText
          id="act-nombre"
          v-model="form.nombre"
          maxlength="250"
          :invalid="enviado && !!errores.nombre"
          :disabled="guardando"
        />
        <Message
          v-if="enviado && errores.nombre"
          severity="error"
          size="small"
          variant="simple"
        >
          {{ errores.nombre }}
        </Message>
      </div>

      <div class="flex flex-col gap-1.5 sm:col-span-2">
        <span
          id="act-tipo-label"
          class="text-sm font-medium text-slate-700"
        >Tipo de cronograma</span>
        <SelectButton
          v-model="form.tipo"
          :options="TIPOS"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-labelledby="act-tipo-label"
          :disabled="guardando"
          data-test="tipo"
        />
        <p class="text-xs text-slate-500">
          {{ form.tipo === 'CONTINUO'
            ? 'Corre de principio a fin, por ejemplo el mantenimiento de un camino. El técnico indica su avance.'
            : 'Ocurre en fechas puntuales, por ejemplo talleres un día a la semana. El técnico marca cada sesión realizada.' }}
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <label
          for="act-inicio"
          class="text-sm font-medium text-slate-700"
        >Fecha de inicio</label>
        <InputText
          id="act-inicio"
          v-model="form.fechaInicio"
          type="date"
          :min="periodo.inicio"
          :max="periodo.fin"
          :invalid="enviado && !!errores.fechas"
          :disabled="guardando"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <label
          for="act-fin"
          class="text-sm font-medium text-slate-700"
        >Fecha de fin</label>
        <InputText
          id="act-fin"
          v-model="form.fechaFin"
          type="date"
          :min="periodo.inicio"
          :max="periodo.fin"
          :invalid="enviado && !!errores.fechas"
          :disabled="guardando"
        />
      </div>
      <Message
        v-if="enviado && errores.fechas"
        severity="error"
        size="small"
        variant="simple"
        class="sm:col-span-2"
        data-test="error-fechas"
      >
        {{ errores.fechas }}
      </Message>

      <!-- Sesiones de una actividad discreta -->
      <fieldset
        v-if="form.tipo === 'DISCRETO'"
        class="rounded-lg border border-slate-200 p-3 sm:col-span-2"
        data-test="bloque-sesiones"
      >
        <legend class="px-1 text-sm font-medium text-slate-700">
          Sesiones
        </legend>
        <div class="flex flex-wrap items-end gap-2">
          <div class="flex flex-col gap-1">
            <label
              for="gen-primera"
              class="text-xs text-slate-500"
            >Primera fecha</label>
            <InputText
              id="gen-primera"
              v-model="gen.primera"
              type="date"
              size="small"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label
              for="gen-cada"
              class="text-xs text-slate-500"
            >Se repite cada (días)</label>
            <InputNumber
              v-model="gen.cadaDias"
              input-id="gen-cada"
              :min="1"
              :max="365"
              size="small"
              input-class="w-24"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label
              for="gen-cantidad"
              class="text-xs text-slate-500"
            >Cantidad</label>
            <InputNumber
              v-model="gen.cantidad"
              input-id="gen-cantidad"
              :min="1"
              :max="100"
              size="small"
              input-class="w-20"
            />
          </div>
          <Button
            type="button"
            label="Generar fechas"
            icon="pi pi-calendar-plus"
            size="small"
            severity="secondary"
            outlined
            :disabled="!gen.primera"
            data-test="generar"
            @click="generar"
          />
        </div>
        <label
          for="act-sesiones"
          class="mb-1 mt-3 block text-xs text-slate-500"
        >Fechas (una por línea, AAAA-MM-DD). Puedes agregar o quitar a mano.</label>
        <Textarea
          id="act-sesiones"
          v-model="form.sesionesTexto"
          rows="4"
          class="w-full font-mono text-xs"
          :invalid="enviado && !!errores.sesiones"
          :disabled="guardando"
          data-test="sesiones"
        />
        <p class="mt-1 text-xs text-slate-500">
          {{ sesiones.length }} {{ sesiones.length === 1 ? 'sesión' : 'sesiones' }} programadas.
        </p>
        <Message
          v-if="enviado && errores.sesiones"
          severity="error"
          size="small"
          variant="simple"
        >
          {{ errores.sesiones }}
        </Message>
      </fieldset>

      <div class="flex flex-col gap-1.5">
        <label
          for="act-resp"
          class="text-sm font-medium text-slate-700"
        >Técnico responsable</label>
        <Select
          v-model="form.responsableId"
          input-id="act-resp"
          :options="equipo"
          option-label="nombre"
          option-value="id"
          placeholder="Sin asignar"
          show-clear
          :disabled="guardando"
        />
        <p
          v-if="equipo.length === 0"
          class="text-xs text-amber-600"
        >
          El proyecto aún no tiene técnicos asignados.
        </p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5">
          <label
            for="act-meta"
            class="text-sm font-medium text-slate-700"
          >Meta</label>
          <InputNumber
            v-model="form.meta"
            input-id="act-meta"
            :min="0"
            :max-fraction-digits="2"
            :disabled="guardando"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label
            for="act-unidad"
            class="text-sm font-medium text-slate-700"
          >Unidad</label>
          <InputText
            id="act-unidad"
            v-model="form.unidadMeta"
            maxlength="150"
            placeholder="talleres…"
            :disabled="guardando"
          />
        </div>
      </div>

      <div class="flex flex-col gap-1.5 sm:col-span-2">
        <label
          for="act-desc"
          class="text-sm font-medium text-slate-700"
        >Descripción (opcional)</label>
        <Textarea
          id="act-desc"
          v-model="form.descripcion"
          rows="3"
          auto-resize
          :disabled="guardando"
        />
      </div>
      <div class="flex flex-col gap-1.5 sm:col-span-2">
        <label
          for="act-fuentes"
          class="text-sm font-medium text-slate-700"
        >Fuentes de verificación (opcional)</label>
        <Textarea
          id="act-fuentes"
          v-model="form.fuentes"
          rows="2"
          auto-resize
          placeholder="Listas de asistencia, actas, registro fotográfico…"
          :disabled="guardando"
        />
      </div>

      <div class="flex justify-end gap-2 sm:col-span-2">
        <Button
          type="button"
          label="Cancelar"
          severity="secondary"
          text
          :disabled="guardando"
          @click="visible = false"
        />
        <Button
          type="submit"
          label="Crear actividad"
          :loading="guardando"
          data-test="guardar-actividad"
        />
      </div>
    </form>
  </Dialog>
</template>