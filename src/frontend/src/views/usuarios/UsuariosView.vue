<script setup lang="ts">
import { isAxiosError } from 'axios';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref, watch } from 'vue';
import type { RolApi } from '@/api/auth';
import type { ProblemDetails } from '@/api/proyectos';
import { editarUsuario, eliminarUsuario, ETIQUETA_ROL, listarUsuarios, type Usuario } from '@/api/usuarios';
import PasswordDialog from '@/components/usuarios/PasswordDialog.vue';
import UsuarioDialog from '@/components/usuarios/UsuarioDialog.vue';
import { useAuthStore } from '@/stores/auth';

/** RF-32 / SGP-55: el Administrador crea, edita, desactiva y elimina cuentas. */
const auth = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const OPCIONES_ROL = (Object.keys(ETIQUETA_ROL) as RolApi[]).map((value) => ({ value, label: ETIQUETA_ROL[value] }));
const OPCIONES_ESTADO = [
  { value: true, label: 'Solo activos' },
  { value: false, label: 'Solo inactivos' },
];
const SEVERIDAD_ROL: Record<RolApi, 'contrast' | 'info' | 'secondary'> = {
  ADMINISTRADOR: 'contrast',
  SUPERVISOR: 'info',
  TECNICO: 'secondary',
};

const filtros = reactive<{ q: string; rol: RolApi | null; activo: boolean | null }>({ q: '', rol: null, activo: null });
const usuarios = ref<Usuario[]>([]);
const cargando = ref(false);
const dialogoUsuario = ref(false);
const dialogoPassword = ref(false);
const seleccionado = ref<Usuario | null>(null);

const esYo = (u: Usuario) => u.id === auth.usuario?.id;
const fecha = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : 'Nunca';

function detalleDe(e: unknown): string {
  const d = isAxiosError<ProblemDetails>(e) ? e.response?.data?.detail : undefined;
  return (Array.isArray(d) ? d.join(' ') : d) ?? 'Inténtalo de nuevo en unos minutos.';
}

async function cargar() {
  cargando.value = true;
  try {
    usuarios.value = await listarUsuarios({
      q: filtros.q.trim() || undefined,
      rol: filtros.rol ?? undefined,
      activo: filtros.activo ?? undefined,
    });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'No se pudo cargar la lista', detail: detalleDe(e), life: 6000 });
  } finally {
    cargando.value = false;
  }
}

let espera: ReturnType<typeof setTimeout> | undefined;
watch(
  () => filtros.q,
  () => {
    clearTimeout(espera);
    espera = setTimeout(cargar, 300);
  },
);
watch(() => [filtros.rol, filtros.activo], cargar);
onMounted(cargar);

function nuevo() {
  seleccionado.value = null;
  dialogoUsuario.value = true;
}
function editar(u: Usuario) {
  seleccionado.value = u;
  dialogoUsuario.value = true;
}
function cambiarPassword(u: Usuario) {
  seleccionado.value = u;
  dialogoPassword.value = true;
}

function alGuardar(u: Usuario, creado: boolean) {
  toast.add({
    severity: 'success',
    summary: creado ? 'Usuario creado' : 'Cambios guardados',
    detail: creado ? `${u.nombre} ya puede ingresar con su correo.` : u.nombre,
    life: 4000,
  });
  cargar();
}

async function alternarActivo(u: Usuario) {
  try {
    const actualizado = await editarUsuario(u.id, { activo: !u.activo });
    toast.add({
      severity: 'success',
      summary: actualizado.activo ? 'Cuenta activada' : 'Cuenta desactivada',
      detail: actualizado.activo ? `${u.nombre} puede volver a ingresar.` : `${u.nombre} ya no puede ingresar y se cerraron sus sesiones.`,
      life: 4000,
    });
    cargar();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'No se pudo cambiar el estado', detail: detalleDe(e), life: 6000 });
  }
}

function eliminar(u: Usuario) {
  confirm.require({
    header: 'Eliminar usuario',
    message: `${u.nombre} ya no podrá ingresar y dejará de aparecer en la lista. Su historial en la bitácora se conserva.`,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Cancelar', severity: 'secondary', text: true },
    acceptProps: { label: 'Eliminar', severity: 'danger' },
    accept: async () => {
      try {
        await eliminarUsuario(u.id);
        toast.add({ severity: 'success', summary: 'Usuario eliminado', detail: u.nombre, life: 4000 });
        cargar();
      } catch (e) {
        toast.add({ severity: 'error', summary: 'No se pudo eliminar', detail: detalleDe(e), life: 6000 });
      }
    },
  });
}
</script>

<template>
  <section class="rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5">
    <div class="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
      <IconField class="min-w-56 flex-1">
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="filtros.q"
          placeholder="Buscar por nombre o correo"
          aria-label="Buscar usuario"
          fluid
          data-test="buscar"
        />
      </IconField>
      <Select
        v-model="filtros.rol"
        :options="OPCIONES_ROL"
        option-label="label"
        option-value="value"
        placeholder="Todos los roles"
        show-clear
        aria-label="Filtrar por rol"
        class="w-52"
      />
      <Select
        v-model="filtros.activo"
        :options="OPCIONES_ESTADO"
        option-label="label"
        option-value="value"
        placeholder="Activos e inactivos"
        show-clear
        aria-label="Filtrar por estado"
        class="w-52"
      />
      <Button
        label="Nuevo usuario"
        icon="pi pi-user-plus"
        class="ml-auto"
        data-test="nuevo-usuario"
        @click="nuevo"
      />
    </div>

    <DataTable
      :value="usuarios"
      :loading="cargando"
      data-key="id"
      striped-rows
      responsive-layout="scroll"
      data-test="tabla-usuarios"
    >
      <template #empty>
        <p class="py-6 text-center text-sm text-slate-500">
          No hay usuarios que coincidan con la búsqueda.
        </p>
      </template>

      <Column header="Usuario">
        <template #body="{ data }">
          <p class="font-medium text-slate-800">
            {{ data.nombre }}
            <span
              v-if="esYo(data)"
              class="text-xs font-normal text-slate-500"
            >(tú)</span>
          </p>
          <p class="text-xs text-slate-500">
            {{ data.email }}
          </p>
        </template>
      </Column>
      <Column header="Rol">
        <template #body="{ data }">
          <Tag
            :value="ETIQUETA_ROL[data.rol as RolApi]"
            :severity="SEVERIDAD_ROL[data.rol as RolApi]"
          />
        </template>
      </Column>
      <Column header="Estado">
        <template #body="{ data }">
          <Tag
            v-if="!data.activo"
            value="Inactivo"
            severity="secondary"
          />
          <Tag
            v-else-if="data.bloqueado"
            value="Bloqueado"
            severity="warn"
            icon="pi pi-lock"
          />
          <Tag
            v-else
            value="Activo"
            severity="success"
          />
        </template>
      </Column>
      <Column header="Último ingreso">
        <template #body="{ data }">
          <span class="text-sm text-slate-600">{{ fecha(data.ultimoLoginAt) }}</span>
        </template>
      </Column>
      <Column
        header="Acciones"
        class="w-48"
      >
        <template #body="{ data }">
          <div class="flex gap-1">
            <Button
              v-tooltip.top="'Editar'"
              icon="pi pi-pencil"
              severity="secondary"
              text
              rounded
              :aria-label="`Editar a ${data.nombre}`"
              data-test="editar"
              @click="editar(data)"
            />
            <Button
              v-tooltip.top="'Restablecer contraseña'"
              icon="pi pi-key"
              severity="secondary"
              text
              rounded
              :aria-label="`Restablecer contraseña de ${data.nombre}`"
              @click="cambiarPassword(data)"
            />
            <Button
              v-tooltip.top="data.activo ? 'Desactivar' : 'Activar'"
              :icon="data.activo ? 'pi pi-ban' : 'pi pi-check-circle'"
              severity="secondary"
              text
              rounded
              :disabled="esYo(data)"
              :aria-label="`${data.activo ? 'Desactivar' : 'Activar'} a ${data.nombre}`"
              data-test="alternar"
              @click="alternarActivo(data)"
            />
            <Button
              v-tooltip.top="'Eliminar'"
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              :disabled="esYo(data)"
              :aria-label="`Eliminar a ${data.nombre}`"
              data-test="eliminar"
              @click="eliminar(data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <UsuarioDialog
      v-model:visible="dialogoUsuario"
      :usuario="seleccionado"
      @guardado="alGuardar"
    />
    <PasswordDialog
      v-model:visible="dialogoPassword"
      :usuario="seleccionado"
      @guardado="toast.add({ severity: 'success', summary: 'Contraseña cambiada', detail: seleccionado?.nombre, life: 4000 })"
    />
  </section>
</template>