// FT-07 (KURA_BACKLOG_FOTO_PET.md, §0 A4 + aceite): as 2 variantes (256/1080)
// nascem NO CLIENTE via expo-image-manipulator, nunca no servidor. Estes
// testes mockam o manipulator (native module, não roda em jest) e provam:
// (1) as 2 larguras pedidas são 256 e 1080; (2) o MESMO formato nas 2
// variantes; (3) o arquivo devolvido é o MANIPULADO, nunca a uri crua do
// picker; (4) na web, se o canvas não codificou WebP de verdade (medido via
// `blob.type`, não presumido), cai para JPEG nas 2 — nunca mistura formato.
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { gerarVariantesFoto } from '../src/utils/fotoPet';

const manipulateAsync = ImageManipulator.manipulateAsync as jest.Mock;
const URI_PICKER_ORIGINAL = 'picker://original.jpg';
// Larguras do CONTRATO (FT-03/backlog), literais de propósito — NÃO
// importadas de src/utils/fotoPet.ts: se importássemos as constantes do
// próprio módulo testado, uma mutação que igualasse as 2 larguras no
// código-fonte também igualaria o valor esperado aqui, e o teste passaria
// verde sem proteger nada (medido: foi exatamente isso que aconteceu ao
// mutar LARGURA_MEDIA para 256 durante a mordida desta task).
const LARGURA_THUMB_CONTRATO = 256;
const LARGURA_MEDIA_CONTRATO = 1080;

const plataformaOriginal = Platform.OS;

function mockManipulateEcoandoLargura(prefixo: string) {
  manipulateAsync.mockImplementation((_uri: string, actions: Array<{ resize: { width: number } }>) => {
    const largura = actions[0]!.resize.width;
    return Promise.resolve({ uri: `${prefixo}${largura}`, width: largura, height: largura });
  });
}

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: plataformaOriginal, configurable: true });
  jest.clearAllMocks();
});

describe('gerarVariantesFoto — nativo (iOS/Android)', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });

  it('pede as 2 larguras exigidas pelo contrato (256 e 1080)', async () => {
    mockManipulateEcoandoLargura('manip://');
    await gerarVariantesFoto(URI_PICKER_ORIGINAL, 42);

    expect(manipulateAsync).toHaveBeenCalledTimes(2);
    const larguras = manipulateAsync.mock.calls
      .map((chamada) => chamada[1][0].resize.width)
      .sort((a, b) => a - b);
    expect(larguras).toEqual([LARGURA_THUMB_CONTRATO, LARGURA_MEDIA_CONTRATO]);
  });

  it('pede o MESMO formato (WebP) nas 2 variantes — o backend rejeita com 400 se divergirem', async () => {
    mockManipulateEcoandoLargura('manip://');
    await gerarVariantesFoto(URI_PICKER_ORIGINAL, 42);

    const formatosPedidos = manipulateAsync.mock.calls.map((chamada) => chamada[2].format);
    expect(new Set(formatosPedidos).size).toBe(1);
    expect(formatosPedidos[0]).toBe(ImageManipulator.SaveFormat.WEBP);
  });

  it('MORDIDA: devolve o arquivo MANIPULADO, nunca a uri original do picker', async () => {
    mockManipulateEcoandoLargura('manip://');
    const resultado = await gerarVariantesFoto(URI_PICKER_ORIGINAL, 42);

    expect(resultado.thumb.uri).not.toBe(URI_PICKER_ORIGINAL);
    expect(resultado.media.uri).not.toBe(URI_PICKER_ORIGINAL);
    expect(resultado.thumb.uri).toBe(`manip://${LARGURA_THUMB_CONTRATO}`);
    expect(resultado.media.uri).toBe(`manip://${LARGURA_MEDIA_CONTRATO}`);
  });

  it('nomeia os arquivos com extensão .webp e mimeType image/webp quando o formato é WebP', async () => {
    mockManipulateEcoandoLargura('manip://');
    const resultado = await gerarVariantesFoto(URI_PICKER_ORIGINAL, 42);

    expect(resultado.thumb.fileName).toBe('pet-42-thumb.webp');
    expect(resultado.media.fileName).toBe('pet-42-media.webp');
    expect(resultado.thumb.mimeType).toBe('image/webp');
    expect(resultado.media.mimeType).toBe('image/webp');
  });

  // Fix wave G2 (m-4, g2-ft07.md M10): resize({width: alvo}) AMPLIA uma foto
  // menor que o alvo — bytes a mais, sem ganho de qualidade.
  it('NÃO amplia: com largura original 600px (menor que o alvo 1080 da media), pede 600 — nunca 1080', async () => {
    mockManipulateEcoandoLargura('manip://');
    await gerarVariantesFoto(URI_PICKER_ORIGINAL, 42, 600);

    const larguras = manipulateAsync.mock.calls
      .map((chamada) => chamada[1][0]!.resize.width)
      .sort((a, b) => a - b);
    // thumb pede 256 (600 > 256, sem clamp) e media pede 600 (600 < 1080,
    // clampado pela largura original) — 1080 NUNCA é pedido aqui.
    expect(larguras).toEqual([256, 600]);
    expect(larguras).not.toContain(LARGURA_MEDIA_CONTRATO);
  });

  it('sem largura original informada (undefined, ou 0 — valor que o picker devolve quando o SO não informa), pede o alvo cheio (comportamento anterior à fix wave G2)', async () => {
    mockManipulateEcoandoLargura('manip://');
    await gerarVariantesFoto(URI_PICKER_ORIGINAL, 42, 0);

    const larguras = manipulateAsync.mock.calls
      .map((chamada) => chamada[1][0]!.resize.width)
      .sort((a, b) => a - b);
    expect(larguras).toEqual([LARGURA_THUMB_CONTRATO, LARGURA_MEDIA_CONTRATO]);
  });
});

describe('gerarVariantesFoto — web (canvas.toBlob)', () => {
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('quando o canvas CODIFICA WebP de verdade (blob.type medido == image/webp), usa WebP nas 2 variantes', async () => {
    mockManipulateEcoandoLargura('blob://');
    global.fetch = jest.fn(
      async () => ({ blob: async () => new Blob([], { type: 'image/webp' }) }) as unknown as Response,
    );

    const resultado = await gerarVariantesFoto(URI_PICKER_ORIGINAL, 7);

    expect(resultado.formato).toBe(ImageManipulator.SaveFormat.WEBP);
    expect(resultado.thumb.mimeType).toBe('image/webp');
    expect(resultado.media.mimeType).toBe('image/webp');
    // A sonda (thumb pedido em WebP) é reaproveitada como o thumb final —
    // só 2 chamadas ao manipulator (thumb + media), não 3.
    expect(manipulateAsync).toHaveBeenCalledTimes(2);
  });

  it('quando o canvas NÃO codifica WebP (fallback silencioso para PNG, medido via blob.type), cai para JPEG NAS 2 — nunca mistura formato', async () => {
    mockManipulateEcoandoLargura('blob://');
    // Sonda: pediu WebP, o browser devolveu PNG de verdade — é exatamente o
    // modo de falha medido na fonte de expo-image-manipulator (canvas.toBlob
    // cai em PNG silenciosamente quando o `type` pedido não é suportado).
    global.fetch = jest.fn(
      async () => ({ blob: async () => new Blob([], { type: 'image/png' }) }) as unknown as Response,
    );

    const resultado = await gerarVariantesFoto(URI_PICKER_ORIGINAL, 7);

    expect(resultado.formato).toBe(ImageManipulator.SaveFormat.JPEG);
    expect(resultado.thumb.mimeType).toBe('image/jpeg');
    expect(resultado.media.mimeType).toBe('image/jpeg');
    expect(resultado.thumb.fileName).toBe('pet-7-thumb.jpg');
    expect(resultado.media.fileName).toBe('pet-7-media.jpg');
    // 3 chamadas: sonda WebP descartada + thumb JPEG + media JPEG.
    expect(manipulateAsync).toHaveBeenCalledTimes(3);
    const formatosNaOrdem = manipulateAsync.mock.calls.map((chamada) => chamada[2].format);
    expect(formatosNaOrdem).toEqual([
      ImageManipulator.SaveFormat.WEBP,
      ImageManipulator.SaveFormat.JPEG,
      ImageManipulator.SaveFormat.JPEG,
    ]);
  });

  // Fix wave G2 (m-4, g2-ft07.md M2): a sonda WebP descartada é uma blob:
  // URL do navegador (canvas.toBlob) que nunca mais é usada — tem que ser
  // revogada, senão vaza memória a cada foto que cai no fallback JPEG.
  it('revoga a blob: URL da sonda descartada quando cai no fallback JPEG', async () => {
    mockManipulateEcoandoLargura('blob://');
    global.fetch = jest.fn(
      async () => ({ blob: async () => new Blob([], { type: 'image/png' }) }) as unknown as Response,
    );
    const revokeSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await gerarVariantesFoto(URI_PICKER_ORIGINAL, 7);

    // A sonda é o thumb pedido em WebP: `blob://256` (LARGURA_THUMB_CONTRATO).
    expect(revokeSpy).toHaveBeenCalledWith(`blob://${LARGURA_THUMB_CONTRATO}`);
    revokeSpy.mockRestore();
  });

  it('NÃO revoga nada quando o canvas codifica WebP de verdade (a sonda é reaproveitada como o thumb final)', async () => {
    mockManipulateEcoandoLargura('blob://');
    global.fetch = jest.fn(
      async () => ({ blob: async () => new Blob([], { type: 'image/webp' }) }) as unknown as Response,
    );
    const revokeSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await gerarVariantesFoto(URI_PICKER_ORIGINAL, 7);

    expect(revokeSpy).not.toHaveBeenCalled();
    revokeSpy.mockRestore();
  });
});
