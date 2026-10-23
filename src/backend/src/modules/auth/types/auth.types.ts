import type { RolUsuario } from '../../proyectos/entities/usuario.entity';

/** Contenido del access token. */
export interface PayloadJwt {
  sub: string;
  rol: RolUsuario;
}

/** Lo que queda en `req.user` tras validar el token. */
export interface UsuarioAutenticado {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
}

/** Perfil que recibe la SPA al iniciar o renovar la sesión. */
export interface PerfilSesion extends UsuarioAutenticado {
  debeCambiarPassword: boolean;
}

export interface SesionEmitida {
  accessToken: string;
  /** Segundos de vida del access token. */
  expiraEn: number;
  usuario: PerfilSesion;
  /** Solo viaja en la cookie HttpOnly; nunca en el cuerpo de la respuesta. */
  refreshToken: string;
  refreshExpiraAt: Date;
}

export interface MetadatosCliente {
  ip?: string;
  userAgent?: string;
}