import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { UsuarioActual } from '../../../common/decorators/usuario-actual.decorator';
import { COOKIE_REFRESH, RUTA_COOKIE_REFRESH } from '../constants/auth.constants';
import { AuthService } from '../services/auth.service';
import type { MetadatosCliente, SesionEmitida, UsuarioAutenticado } from '../types/auth.types';
import { LoginDto } from '../dto/login.dto';
import { RestablecerPasswordDto } from '../dto/restablecer-password.dto';
import { SolicitarRestablecimientoDto } from '../dto/solicitar-restablecimiento.dto';
import { PasswordResetService } from '../services/password-reset.service';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  private readonly cookieSegura: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
    config: ConfigService,
  ) {
    this.cookieSegura = config.get<string>('NODE_ENV') === 'production';
  }

  /** SGP-40. Límite propio: 10 intentos por minuto por IP, además del bloqueo por cuenta. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sesion = await this.auth.login(dto.email, dto.password, this.cliente(req));
    return this.responder(sesion, res);
  }

  /** La SPA lo llama al cargar y cuando el access token vence. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const sesion = await this.auth.refrescar(this.leerCookie(req), this.cliente(req));
      return this.responder(sesion, res);
    } catch (e) {
      res.clearCookie(COOKIE_REFRESH, this.opcionesCookie());
      throw e;
    }
  }

  /** SGP-45. Público para poder cerrar sesión aunque el access token ya haya vencido. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.cerrarSesion(this.leerCookie(req));
    res.clearCookie(COOKIE_REFRESH, this.opcionesCookie());
  }

  /** SGP-110: pide el enlace de restablecimiento. Responde 202 siempre igual, exista o no el correo. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('olvide-mi-contrasena')
  @HttpCode(HttpStatus.ACCEPTED)
  async olvideMiContrasena(@Body() dto: SolicitarRestablecimientoDto) {
    await this.passwordReset.solicitar(dto.email);
    return { mensaje: 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.' };
  }

  /** SGP-110 / CP-33: define la nueva contraseña con el token del enlace (un solo uso, 30 min). */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('restablecer-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restablecerPassword(@Body() dto: RestablecerPasswordDto): Promise<void> {
    await this.passwordReset.restablecer(dto.token, dto.password);
  }

  @Get('me')
  me(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.auth.perfil(usuario.id);
  }

  /** El refresh token va solo en la cookie HttpOnly; el cuerpo lleva el access token y el perfil. */
  private responder(sesion: SesionEmitida, res: Response) {
    res.cookie(COOKIE_REFRESH, sesion.refreshToken, {
      ...this.opcionesCookie(),
      expires: sesion.refreshExpiraAt,
    });
    return { accessToken: sesion.accessToken, expiraEn: sesion.expiraEn, usuario: sesion.usuario };
  }

  private opcionesCookie(): CookieOptions {
    return { httpOnly: true, secure: this.cookieSegura, sameSite: 'strict', path: RUTA_COOKIE_REFRESH };
  }

  private leerCookie(req: Request): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[COOKIE_REFRESH];
  }

  private cliente(req: Request): MetadatosCliente {
    return { ip: req.ip, userAgent: req.get('user-agent') };
  }
}