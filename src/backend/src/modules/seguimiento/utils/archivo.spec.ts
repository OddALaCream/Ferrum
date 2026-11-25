import { detectarTipo, motivoRechazo, nombreLimpio, sha256, TAMANO_MAXIMO, type ArchivoSubido } from './archivo';

const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj');
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

const archivo = (buffer: Buffer, cambios: Partial<ArchivoSubido> = {}): ArchivoSubido => ({
  originalname: 'acta.pdf',
  mimetype: 'application/pdf',
  size: buffer.length,
  buffer,
  ...cambios,
});

describe('detectarTipo: el tipo sale del contenido, no de la extensión', () => {
  it('reconoce PDF, JPG, PNG y WEBP por su firma', () => {
    expect(detectarTipo(PDF)).toBe('application/pdf');
    expect(detectarTipo(JPG)).toBe('image/jpeg');
    expect(detectarTipo(PNG)).toBe('image/png');
    expect(detectarTipo(WEBP)).toBe('image/webp');
  });

  it('rechaza lo demás aunque se llame .pdf: un ejecutable, un ZIP (Word, Excel) o un texto', () => {
    expect(detectarTipo(Buffer.from('MZ\x90\x00'))).toBeNull();
    expect(detectarTipo(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
    expect(detectarTipo(Buffer.from('hola, soy un pdf'))).toBeNull();
    expect(detectarTipo(Buffer.alloc(0))).toBeNull();
  });
});

describe('motivoRechazo', () => {
  it('acepta un PDF de 3 MB (CP-12)', () => {
    const tres = Buffer.concat([PDF, Buffer.alloc(3 * 1024 * 1024)]);
    expect(motivoRechazo(archivo(tres))).toBeNull();
  });

  it('rechaza lo que pasa de 25 MB, diciendo cuánto pesa', () => {
    const motivo = motivoRechazo(archivo(PDF, { size: TAMANO_MAXIMO + 1 }));
    expect(motivo).toContain('25 MB');
    expect(motivo).toContain('25.0 MB');
  });

  it('rechaza un tipo no admitido, nombrando el archivo y los tipos que sí se aceptan', () => {
    const motivo = motivoRechazo(archivo(Buffer.from([0x50, 0x4b, 0x03, 0x04]), { originalname: 'informe.docx' }));
    expect(motivo).toContain('informe.docx');
    expect(motivo).toContain('PDF, JPG, PNG, WEBP');
  });

  it('rechaza la falta de archivo o un archivo vacío', () => {
    expect(motivoRechazo(undefined)).toContain('Adjunta un archivo');
    expect(motivoRechazo(archivo(Buffer.alloc(0)))).toContain('Adjunta un archivo');
  });
});

describe('nombreLimpio y sha256', () => {
  it('quita rutas y caracteres de control y respeta tildes', () => {
    expect(nombreLimpio('C:\\fotos\\taller.jpg')).toBe('taller.jpg');
    expect(nombreLimpio('../../etc/passwd')).toBe('passwd');
    expect(nombreLimpio(Buffer.from('Acta reunión año.pdf', 'utf8').toString('latin1'))).toBe('Acta reunión año.pdf');
    expect(nombreLimpio('a\u0000b.pdf')).toBe('ab.pdf');
    expect(nombreLimpio('   ')).toBe('evidencia');
    expect(nombreLimpio('x'.repeat(300))).toHaveLength(255);
  });

  it('calcula la huella SHA-256 en hexadecimal', () => {
    expect(sha256(Buffer.from('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});