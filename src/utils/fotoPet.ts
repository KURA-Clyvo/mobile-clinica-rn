import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

// FT-07 (KURA_BACKLOG_FOTO_PET.md, §0 A4): compressão e as 2 variantes
// nascem NO CLIENTE, nunca no servidor — o `.NET` não tem lib de imagem e
// não ganha uma. O reencode (via expo-image-manipulator) remove EXIF/GPS da
// foto original: é essa a garantia de privacidade, não o picker.
export const LARGURA_THUMB = 256;
export const LARGURA_MEDIA = 1080;
export const QUALIDADE_COMPRESSAO = 0.7;

export interface FotoVarianteGerada {
  uri: string;
  fileName: string;
  mimeType: string;
}

export interface FotoVariantesGeradas {
  thumb: FotoVarianteGerada;
  media: FotoVarianteGerada;
  formato: ImageManipulator.SaveFormat;
}

function extensaoDoFormato(formato: ImageManipulator.SaveFormat): string {
  switch (formato) {
    case ImageManipulator.SaveFormat.WEBP:
      return 'webp';
    case ImageManipulator.SaveFormat.PNG:
      return 'png';
    case ImageManipulator.SaveFormat.JPEG:
    default:
      return 'jpg';
  }
}

function mimeDoFormato(formato: ImageManipulator.SaveFormat): string {
  switch (formato) {
    case ImageManipulator.SaveFormat.WEBP:
      return 'image/webp';
    case ImageManipulator.SaveFormat.PNG:
      return 'image/png';
    case ImageManipulator.SaveFormat.JPEG:
    default:
      return 'image/jpeg';
  }
}

async function manipular(
  uriOrigem: string,
  largura: number,
  formato: ImageManipulator.SaveFormat,
): Promise<ImageManipulator.ImageResult> {
  return ImageManipulator.manipulateAsync(
    uriOrigem,
    [{ resize: { width: largura } }],
    { compress: QUALIDADE_COMPRESSAO, format: formato },
  );
}

/**
 * MEDIDO na fonte (node_modules/expo-image-manipulator/src/web/
 * ImageManipulatorImageRef.web.ts, SDK 54, expo-image-manipulator 14.0.8):
 * a implementação web usa `canvas.toBlob(callback, 'image/webp', qualidade)`.
 * Pela spec do Canvas, quando o `type` pedido não é suportado pelo browser o
 * navegador cai em PNG **silenciosamente** — o callback recebe um blob válido
 * (não nulo, não lança), só que do formato errado. Não há como saber isso
 * SEM checar o resultado: por isso esta função busca a URI já manipulada de
 * volta e lê `blob.type` de verdade, em vez de assumir que o `format`
 * pedido foi o `format` produzido.
 *
 * Só roda na web — no nativo (iOS/Android) o encoder de WebP é da SDK nativa
 * do Expo (libwebp embarcado), sem esse modo de falha silenciosa.
 */
async function webCodificouFormato(
  uri: string,
  formato: ImageManipulator.SaveFormat,
): Promise<boolean> {
  const resposta = await fetch(uri);
  const blob = await resposta.blob();
  return blob.type === mimeDoFormato(formato);
}

/**
 * Gera as 2 variantes exigidas pelo contrato do backend (FT-03): 256px
 * (thumb/lista) e 1080px (detalhe), MESMO formato nas duas — o backend
 * detecta o formato pelos magic bytes e rejeita com 400 se thumb e media
 * divergirem (g0-foto-pet.md, achado F7-a).
 *
 * Prefere WebP ~0,7 (meta do G0). Na web, mede se o canvas realmente
 * codificou WebP (ver `webCodificouFormato`) e cai para JPEG nas 2 variantes
 * se não codificou — nunca mistura os 2 formatos entre thumb/media.
 */
export async function gerarVariantesFoto(
  uriOriginal: string,
  idPet: number,
): Promise<FotoVariantesGeradas> {
  let formato = ImageManipulator.SaveFormat.WEBP;

  if (Platform.OS === 'web') {
    const sondaThumb = await manipular(uriOriginal, LARGURA_THUMB, formato);
    const codificouWebp = await webCodificouFormato(sondaThumb.uri, formato);
    if (codificouWebp) {
      const media = await manipular(uriOriginal, LARGURA_MEDIA, formato);
      return montarResultado(sondaThumb, media, formato, idPet);
    }
    // Fallback medido: este navegador não codifica WebP via canvas (ex.:
    // Safari mais antigo) — refaz as 2 variantes em JPEG, que tem suporte
    // universal em `canvas.toBlob`. Descarta a sonda (era WebP pedido, PNG
    // devolvido pelo browser) para não deixar as 2 partes em formatos
    // diferentes.
    formato = ImageManipulator.SaveFormat.JPEG;
  }

  const [thumb, media] = await Promise.all([
    manipular(uriOriginal, LARGURA_THUMB, formato),
    manipular(uriOriginal, LARGURA_MEDIA, formato),
  ]);
  return montarResultado(thumb, media, formato, idPet);
}

function montarResultado(
  thumb: ImageManipulator.ImageResult,
  media: ImageManipulator.ImageResult,
  formato: ImageManipulator.SaveFormat,
  idPet: number,
): FotoVariantesGeradas {
  const extensao = extensaoDoFormato(formato);
  const mimeType = mimeDoFormato(formato);
  return {
    thumb: { uri: thumb.uri, fileName: `pet-${idPet}-thumb.${extensao}`, mimeType },
    media: { uri: media.uri, fileName: `pet-${idPet}-media.${extensao}`, mimeType },
    formato,
  };
}
