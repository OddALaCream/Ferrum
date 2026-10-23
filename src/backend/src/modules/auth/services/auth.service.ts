import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Usuario } from '../../proyectos/entities/usuario.entity';
import { MAX_INTENTOS_FALLIDOS, MINUTOS_BLOQUEO } from '../constants/auth.constants';
import type { MetadatosCliente, PayloadJwt, PerfilSesion, SesionEmitida } from '../types/auth.types';
import { duracionAMs } from '../utils/duracion';
import { RefreshToken } from '../entities/refresh-token.entity';
import { verificarPassword } from '../utils/password';

const MSG_CREDENCIALES = 'Correo o contraseña incorrectos.';
const MSG_SESION_INVALIDA = 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.';

const sha256 = (valor: string) => createHash('sha256').update(valor).digest('hex');

@Injectable()
export class AuthService {
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(RefreshToken) private readonly tokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessTtlMs = duracionAMs(config.get<string>('JWT_ACCESS_TTL', '15m'));
    this.refreshTtlMs = duracionAMs(config.get<string>('JWT_REFRESH_TTL', '7d'));
  }

  /**
   * RF-17 / SGP-4. Reglas:
   * - Correo inexistente y contraseña errónea responden igual (no se revela qué correos existen).
   * - Al 5.º fallo seguido la cuenta se bloquea 15 min; mientras dure, ni la contraseña correcta entra (CP-17).
   * - Un ingreso correcto reinicia el contador.
   */
  async login(email: string, password: string, cliente: MetadatosCliente = {}): Promise<SesionEmitida> {
    const usuario = await this.usuarios.findOne({ where: { email: email.trim(), deletedAt: IsNull() } });
    if (!usuario) {
      await verificarPassword(password, null); // mismo tiempo de respuesta que un correo real
      throw new UnauthorizedException(MSG_CREDENCIALES);
    }

    const ahora = new Date();
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
      throw this.errorBloqueo(usuario.bloqueadoHasta, ahora);
    }

    if (!(await verificarPassword(password, usuario.passwordHash))) {
      await this.registrarFallo(usuario, ahora);
      throw new UnauthorizedException(MSG_CREDENCIALES);
    }

    if (!usuario.activo) {
      throw new ForbiddenException('Tu cuenta está desactivada. Pide al administrador que la reactive.');
    }

    await this.usuarios.update(usuario.id, {
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimoLoginAt: ahora,
    });
    return this.emitirSesion(usuario, randomUUID(), cliente);
  }

  /** Rota el refresh token: el anterior queda revocado y apunta al nuevo. */
  async refrescar(refreshToken: string | undefined, cliente: MetadatosCliente = {}): Promise<SesionEmitida> {
    if (!refreshToken) throw new UnauthorizedException(MSG_SESION_INVALIDA);

    const actual = await this.tokens.findOne({
      where: { tokenHash: sha256(refreshToken) },
      relations: { usuario: true },
    });
    if (!actual) throw new UnauthorizedException(MSG_SESION_INVALIDA);

    const ahora = new Date();
    if (actual.revocadoAt) {
      // Reutilización de un token ya rotado: posible robo, se corta toda la cadena
      await this.revocarFamilia(actual.familiaId, ahora);
      throw new UnauthorizedException(MSG_SESION_INVALIDA);
    }

    const u = actual.usuario;
    const sinAcceso = !u || !u.activo || u.deletedAt !== null || (u.bloqueadoHasta !== null && u.bloqueadoHasta > ahora);
    if (actual.expiraAt <= ahora || sinAcceso) {
      await this.revocarFamilia(actual.familiaId, ahora);
      throw new UnauthorizedException(MSG_SESION_INVALIDA);
    }

    // Se "reclama" el token con una condición: si dos pestañas lo usan a la vez, solo una gana
    const reclamado = await this.tokens.update({ id: actual.id, revocadoAt: IsNull() }, { revocadoAt: ahora });
    if (!reclamado.affected) {
      await this.revocarFamilia(actual.familiaId, ahora);
      throw new UnauthorizedException(MSG_SESION_INVALIDA);
    }

    const sesion = await this.emitirSesion(u, actual.familiaId, cliente);
    const nuevo = await this.tokens.findOne({ where: { tokenHash: sha256(sesion.refreshToken) } });
    if (nuevo) await this.tokens.update(actual.id, { reemplazadoPor: nuevo.id });
    return sesion;
  }

  /** SGP-45: invalida la sesión del dispositivo (toda la familia del refresh token). */
  async cerrarSesion(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const actual = await this.tokens.findOne({ where: { tokenHash: sha256(refreshToken) } });
    if (actual) await this.revocarFamilia(actual.familiaId, new Date());
  }

  async perfil(usuarioId: string): Promise<PerfilSesion> {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId, activo: true, deletedAt: IsNull() } });
    if (!usuario) throw new UnauthorizedException(MSG_SESION_INVALIDA);
    return this.aPerfil(usuario);
  }

  private async registrarFallo(usuario: Usuario, ahora: Date): Promise<void> {
    const intentos = usuario.intentosFallidos + 1;
    if (intentos >= MAX_INTENTOS_FALLIDOS) {
      const hasta = new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60_000);
      await this.usuarios.update(usuario.id, { intentosFallidos: 0, bloqueadoHasta: hasta });
      throw this.errorBloqueo(hasta, ahora);
    }
    await this.usuarios.update(usuario.id, { intentosFallidos: intentos });
  }

  private errorBloqueo(hasta: Date, ahora: Date): HttpException {
    const minutos = Math.max(1, Math.ceil((hasta.getTime() - ahora.getTime()) / 60_000));
    return new HttpException(
      `Cuenta bloqueada por ${MAX_INTENTOS_FALLIDOS} intentos fallidos. Vuelve a intentarlo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`,
      HttpStatus.LOCKED,
    );
  }

  private async emitirSesion(usuario: Usuario, familiaId: string, cliente: MetadatosCliente): Promise<SesionEmitida> {
    const payload: PayloadJwt = { sub: usuario.id, rol: usuario.rol };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: Math.floor(this.accessTtlMs / 1000) });

    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExpiraAt = new Date(Date.now() + this.refreshTtlMs);
    await this.tokens.insert({
      usuarioId: usuario.id,
      familiaId,
      tokenHash: sha256(refreshToken),
      expiraAt: refreshExpiraAt,
      ip: cliente.ip ?? null,
      userAgent: cliente.userAgent?.slice(0, 300) ?? null,
    });

    return {
      accessToken,
      expiraEn: Math.floor(this.accessTtlMs / 1000),
      usuario: this.aPerfil(usuario),
      refreshToken,
      refreshExpiraAt,
    };
  }

  private async revocarFamilia(familiaId: string, ahora: Date): Promise<void> {
    await this.tokens.update({ familiaId, revocadoAt: IsNull() }, { revocadoAt: ahora });
  }

  private aPerfil(u: Usuario): PerfilSesion {
    return { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, debeCambiarPassword: u.debeCambiarPassword };
  }
}