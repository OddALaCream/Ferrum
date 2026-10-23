import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { MailService } from '../../../infrastructure/mail/mail.service';
import { Usuario } from '../../proyectos/entities/usuario.entity';
import { MINUTOS_VIGENCIA_RESET } from '../constants/auth.constants';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { correoRestablecer } from '../utils/correo-restablecer';
import { hashPassword } from '../utils/password';
import { AuthService } from './auth.service';

const MSG_ENLACE_INVALIDO = 'El enlace no es válido o ya venció. Pide uno nuevo desde "¿Olvidaste tu contraseña?".';
const sha256 = (valor: string) => createHash('sha256').update(valor).digest('hex');

/**
 * RF-33 / SGP-110: recuperación de contraseña por correo.
 * - La solicitud responde siempre igual: no revela qué correos están registrados.
 * - El enlace es de un solo uso y vence a los 30 min (CP-33); pedir uno nuevo invalida los anteriores.
 * - Al restablecer se desbloquea la cuenta y se cierran todas sus sesiones.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly urlBase: string;

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(PasswordResetToken) private readonly tokens: Repository<PasswordResetToken>,
    private readonly mail: MailService,
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.urlBase = config.get<string>('APP_BASE_URL', 'http://localhost:5173').replace(/\/+$/, '');
  }

  /** Genera el enlace y lo envía. Nunca lanza por correo inexistente ni por fallo del SMTP. */
  async solicitar(email: string): Promise<void> {
    const usuario = await this.usuarios.findOne({
      where: { email: email.trim(), activo: true, deletedAt: IsNull() },
    });
    if (!usuario) return;

    const ahora = new Date();
    // Los enlaces anteriores sin usar dejan de servir
    await this.tokens.update({ usuarioId: usuario.id, usadoAt: IsNull() }, { usadoAt: ahora });

    const token = randomBytes(32).toString('base64url');
    await this.tokens.insert({
      usuarioId: usuario.id,
      tokenHash: sha256(token),
      expiraAt: new Date(ahora.getTime() + MINUTOS_VIGENCIA_RESET * 60_000),
    });

    const enlace = `${this.urlBase}/restablecer?token=${token}`;
    const correo = correoRestablecer(usuario.nombre, enlace);
    // Se envía sin esperar: la respuesta tarda lo mismo exista o no el correo, y un SMTP caído no rompe la solicitud
    void this.mail
      .send({ to: usuario.email, subject: correo.subject, html: correo.html, text: correo.text })
      .catch((e: unknown) =>
        this.logger.error(`No se pudo enviar el correo de restablecimiento: ${e instanceof Error ? e.message : String(e)}`),
      );
  }

  /** Cambia la contraseña con el token del enlace. Un token usado, vencido o inexistente responde igual (400). */
  async restablecer(token: string, password: string): Promise<void> {
    const ahora = new Date();
    const registro = await this.tokens.findOne({
      where: { tokenHash: sha256(token), usadoAt: IsNull(), expiraAt: MoreThan(ahora) },
      relations: { usuario: true },
    });
    if (!registro || !registro.usuario || !registro.usuario.activo || registro.usuario.deletedAt) {
      throw new BadRequestException(MSG_ENLACE_INVALIDO);
    }

    // "Reclamar" el token con condición: si se usa dos veces a la vez, solo una gana
    const reclamado = await this.tokens.update({ id: registro.id, usadoAt: IsNull() }, { usadoAt: ahora });
    if (!reclamado.affected) throw new BadRequestException(MSG_ENLACE_INVALIDO);

    await this.usuarios.update(registro.usuarioId, {
      passwordHash: await hashPassword(password),
      debeCambiarPassword: false,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    });
    await this.auth.revocarSesionesDe(registro.usuarioId);
  }
}