import type { RolUsuario } from '../../proyectos/entities/usuario.entity';

/** Lo que la API devuelve de un usuario. Nunca incluye el hash de la contraseña. */
export interface UsuarioVista {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  bloqueado: boolean;
  debeCambiarPassword: boolean;
  ultimoLoginAt: Date | null;
  createdAt: Date;
}