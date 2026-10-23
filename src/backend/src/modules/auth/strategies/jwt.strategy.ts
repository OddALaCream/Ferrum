import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IsNull, Repository } from 'typeorm';
import { Usuario } from '../../proyectos/entities/usuario.entity';
import type { PayloadJwt, UsuarioAutenticado } from '../types/auth.types';

/** Valida el access token del header `Authorization: Bearer ...` (SGP-40). */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /** Se consulta la base en cada petición para que una cuenta desactivada pierda el acceso al instante. */
  async validate(payload: PayloadJwt): Promise<UsuarioAutenticado> {
    const usuario = await this.usuarios.findOne({
      where: { id: payload.sub, activo: true, deletedAt: IsNull() },
      select: { id: true, email: true, nombre: true, rol: true },
    });
    if (!usuario) throw new UnauthorizedException('Tu cuenta ya no tiene acceso al sistema.');
    return { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol };
  }
}