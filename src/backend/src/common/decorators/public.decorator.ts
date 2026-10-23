import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'esPublico';

/** Marca una ruta como accesible sin sesión (login, refresh, health). */
export const Public = () => SetMetadata(ES_PUBLICO, true);