import { ConfigService } from '@nestjs/config';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageAdapter, RUTA_DESCARGA } from './local-storage.adapter';

describe('LocalStorageAdapter (STORAGE_DRIVER=local)', () => {
  let dir: string;
  let almacen: LocalStorageAdapter;
  const config = (valores: Record<string, string>) => ({
    get: (k: string, def?: string) => valores[k] ?? def,
    getOrThrow: (k: string) => valores[k],
  }) as unknown as ConfigService;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sgp-almacen-'));
    almacen = new LocalStorageAdapter(config({ STORAGE_DIR: dir, JWT_ACCESS_SECRET: 'x'.repeat(40) }));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const parametros = (url: string) => {
    const q = new URL(url, 'http://localhost').searchParams;
    return [q.get('k')!, q.get('exp')!, q.get('sig')!] as const;
  };
  const leer = async (abierto: Awaited<ReturnType<LocalStorageAdapter['abrir']>>) => {
    const partes: Buffer[] = [];
    for await (const p of abierto!.stream) partes.push(p as Buffer);
    return Buffer.concat(partes).toString();
  };

  it('guarda el archivo en su carpeta y crea las subcarpetas', async () => {
    await almacen.upload('avances/a1/uno.pdf', Buffer.from('%PDF-hola'), 'application/pdf');
    expect(readFileSync(join(dir, 'avances/a1/uno.pdf'), 'utf8')).toBe('%PDF-hola');
  });

  it('nunca sobrescribe un archivo existente (las evidencias son inmutables)', async () => {
    await almacen.upload('a/x.pdf', Buffer.from('1'), 'application/pdf');
    await expect(almacen.upload('a/x.pdf', Buffer.from('2'), 'application/pdf')).rejects.toThrow();
    expect(readFileSync(join(dir, 'a/x.pdf'), 'utf8')).toBe('1');
  });

  it('el enlace firmado es relativo y abre el archivo con su tipo', async () => {
    await almacen.upload('avances/a1/foto.png', Buffer.from('imagen'), 'image/png');
    const url = await almacen.presignedDownloadUrl('avances/a1/foto.png');
    expect(url.startsWith(`${RUTA_DESCARGA}?`)).toBe(true);

    const abierto = await almacen.abrir(...parametros(url));
    expect(abierto).toMatchObject({ tipo: 'image/png', tamano: 6 });
    expect(await leer(abierto)).toBe('imagen');
  });

  it('rechaza un enlace alterado, de otro archivo o vencido', async () => {
    await almacen.upload('a/uno.pdf', Buffer.from('1'), 'application/pdf');
    await almacen.upload('a/dos.pdf', Buffer.from('2'), 'application/pdf');
    const [k, exp, sig] = parametros(await almacen.presignedDownloadUrl('a/uno.pdf'));

    // Se cambia el último carácter por otro distinto: con uno fijo, a veces la firma quedaba igual
    expect(await almacen.abrir(k, exp, `${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`)).toBeNull();
    expect(await almacen.abrir('a/dos.pdf', exp, sig)).toBeNull();
    expect(await almacen.abrir(k, String(Number(exp) + 60), sig)).toBeNull();

    const [k2, exp2, sig2] = parametros(await almacen.presignedDownloadUrl('a/uno.pdf', -1));
    expect(await almacen.abrir(k2, exp2, sig2)).toBeNull();
  });

  it('no deja salir de su carpeta con "../" ni rutas absolutas', async () => {
    await expect(almacen.upload('../fuera.pdf', Buffer.from('x'), 'application/pdf')).rejects.toThrow('no válido');
    await expect(almacen.upload('a/../../fuera.pdf', Buffer.from('x'), 'application/pdf')).rejects.toThrow('no válido');
    await expect(almacen.upload('/etc/x.pdf', Buffer.from('x'), 'application/pdf')).rejects.toThrow('no válido');
    await expect(almacen.presignedDownloadUrl('../../.env')).rejects.toThrow('no válido');
  });

  it('borra el archivo, y borrar uno que ya no existe no falla', async () => {
    await almacen.upload('a/x.pdf', Buffer.from('1'), 'application/pdf');
    await almacen.remove('a/x.pdf');
    expect(existsSync(join(dir, 'a/x.pdf'))).toBe(false);
    await expect(almacen.remove('a/x.pdf')).resolves.toBeUndefined();
  });

  it('ping crea la carpeta si no existe', async () => {
    const otra = new LocalStorageAdapter(config({ STORAGE_DIR: join(dir, 'nueva'), JWT_ACCESS_SECRET: 'x'.repeat(40) }));
    await otra.ping();
    expect(existsSync(join(dir, 'nueva'))).toBe(true);
  });

  it('otra instalación (otro secreto) no puede usar los enlaces de esta', async () => {
    await almacen.upload('a/x.pdf', Buffer.from('1'), 'application/pdf');
    const ajena = new LocalStorageAdapter(config({ STORAGE_DIR: dir, JWT_ACCESS_SECRET: 'y'.repeat(40) }));
    expect(await ajena.abrir(...parametros(await almacen.presignedDownloadUrl('a/x.pdf')))).toBeNull();
  });
});