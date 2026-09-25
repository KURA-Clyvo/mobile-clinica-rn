// FT-07, fix wave G2 (I-1 — bloqueante). `useUploadFotoPet` (usePetDetail.ts) é o
// ÚNICO ponto que liga o gerador de variantes (utils/fotoPet.ts::gerarVariantesFoto)
// ao service (pets.service.ts::uploadFoto) — é aqui, na integração, que a regra A4
// (nunca subir o arquivo cru do picker, por causa do EXIF/GPS) se realiza de fato.
// A revisão G2 (g2-ft07.md, M7) mutou o hook e proveu 4 mordidas, TODAS `EXIT=0`,
// TODAS sobreviventes, porque nenhum teste deste arquivo existia antes desta fix
// wave:
//   G  — uploadFoto(id, thumb, thumb): a MESMA variante nas 2 partes
//   H  — remove invalidateQueries(['pets', id])
//   A2 — hook ignora gerarVariantesFoto e sobe a uri CRUA do picker nas 2 partes
//   I  — uploadFoto(id, media, thumb): partes TROCADAS
// As mordidas ficam registradas (mutação real aplicada no hook + suíte completa +
// EXIT + restauração) em `ft-07-report.md`, não neste arquivo.
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUploadFotoPet } from '../src/hooks/usePetDetail';
import { uploadFoto } from '../src/services/pets.service';
import { gerarVariantesFoto } from '../src/utils/fotoPet';
import type { FotoVarianteGerada } from '../src/utils/fotoPet';

jest.mock('@services/pets.service', () => ({
  getPetById: jest.fn(),
  uploadFoto: jest.fn(),
}));
jest.mock('@utils/fotoPet', () => ({
  gerarVariantesFoto: jest.fn(),
}));

const mockUploadFoto = uploadFoto as jest.Mock;
const mockGerarVariantes = gerarVariantesFoto as jest.Mock;

// Literais do CONTRATO/fixture — não derivados de nenhuma constante do hook nem
// do módulo `fotoPet.ts` testado (ver a mesma regra em tests/fotoPet.test.ts):
// mutar o hook não pode acidentalmente mudar também o valor esperado aqui.
const URI_PICKER_ORIGINAL = 'picker://original.jpg';
const ID_PET = 9;
const THUMB: FotoVarianteGerada = {
  uri: 'manip://thumb-256',
  fileName: 'pet-9-thumb.webp',
  mimeType: 'image/webp',
};
const MEDIA: FotoVarianteGerada = {
  uri: 'manip://media-1080',
  fileName: 'pet-9-media.webp',
  mimeType: 'image/webp',
};
const RESPOSTA_UPLOAD = {
  idPet: ID_PET,
  dsFotoChave: 'clinica/1/pet/9/ab12.webp',
  dtFotoAtualizacao: '2026-09-25T12:00:00.000Z',
};

function makeWrapperComCliente() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGerarVariantes.mockResolvedValue({ thumb: THUMB, media: MEDIA, formato: 'webp' });
  mockUploadFoto.mockResolvedValue(RESPOSTA_UPLOAD);
});

describe('useUploadFotoPet', () => {
  it('gera as variantes a partir da uri do picker e sobe (idPet, thumb, media) NESSA ordem — MORDIDA A2 (nunca a uri crua, regra A4/EXIF)', async () => {
    const { wrapper } = makeWrapperComCliente();
    const { result } = renderHook(() => useUploadFotoPet(), { wrapper });

    result.current.mutate({ idPet: ID_PET, uriOriginal: URI_PICKER_ORIGINAL });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGerarVariantes).toHaveBeenCalledWith(URI_PICKER_ORIGINAL, ID_PET, undefined);
    expect(mockUploadFoto).toHaveBeenCalledTimes(1);
    expect(mockUploadFoto).toHaveBeenCalledWith(ID_PET, THUMB, MEDIA);
    // Checagem explícita de conteúdo (não só "foi chamado"): a mordida A2 do G2
    // (hook sobe a uri crua do picker nas 2 partes, ignorando o gerador) passaria
    // batido numa asserção que só checasse presença de chamada.
    const [, thumbEnviado, mediaEnviado] = mockUploadFoto.mock.calls[0] as [number, FotoVarianteGerada, FotoVarianteGerada];
    expect(thumbEnviado.uri).not.toBe(URI_PICKER_ORIGINAL);
    expect(mediaEnviado.uri).not.toBe(URI_PICKER_ORIGINAL);
  });

  it('MORDIDA G — thumb e media têm que ser as variantes DISTINTAS que o gerador devolveu, nunca a mesma nas 2 partes', async () => {
    const { wrapper } = makeWrapperComCliente();
    const { result } = renderHook(() => useUploadFotoPet(), { wrapper });

    result.current.mutate({ idPet: ID_PET, uriOriginal: URI_PICKER_ORIGINAL });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [, thumbEnviado, mediaEnviado] = mockUploadFoto.mock.calls[0] as [number, FotoVarianteGerada, FotoVarianteGerada];
    expect(thumbEnviado.uri).not.toBe(mediaEnviado.uri);
    expect(thumbEnviado).toEqual(THUMB);
    expect(mediaEnviado).toEqual(MEDIA);
  });

  it('MORDIDA I — thumb vai no 2º argumento e media no 3º, NUNCA trocados', async () => {
    const { wrapper } = makeWrapperComCliente();
    const { result } = renderHook(() => useUploadFotoPet(), { wrapper });

    result.current.mutate({ idPet: ID_PET, uriOriginal: URI_PICKER_ORIGINAL });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const chamada = mockUploadFoto.mock.calls[0] as [number, FotoVarianteGerada, FotoVarianteGerada];
    expect(chamada[1].fileName).toBe(THUMB.fileName);
    expect(chamada[2].fileName).toBe(MEDIA.fileName);
  });

  it('MORDIDA H — invalida a query ["pets", idPet] no SUCESSO (senão a tela seguinte serve o cache stale por até 120s)', async () => {
    const { qc, wrapper } = makeWrapperComCliente();
    qc.setQueryData(['pets', ID_PET], { id: ID_PET, nmPet: 'Buldogue' });
    // Controle positivo: a query nasce FRESCA — sem isso, um `true` no final
    // seria indistinguível de "já estava invalidada desde sempre".
    expect(qc.getQueryState(['pets', ID_PET])?.isInvalidated).toBe(false);
    const spy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUploadFotoPet(), { wrapper });
    result.current.mutate({ idPet: ID_PET, uriOriginal: URI_PICKER_ORIGINAL });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledWith({ queryKey: ['pets', ID_PET] });
    expect(qc.getQueryState(['pets', ID_PET])?.isInvalidated).toBe(true);
  });

  it('repassa larguraOriginal (fix wave G2, m-4) para gerarVariantesFoto sem alteração', async () => {
    const { wrapper } = makeWrapperComCliente();
    const { result } = renderHook(() => useUploadFotoPet(), { wrapper });

    result.current.mutate({ idPet: ID_PET, uriOriginal: URI_PICKER_ORIGINAL, larguraOriginal: 600 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGerarVariantes).toHaveBeenCalledWith(URI_PICKER_ORIGINAL, ID_PET, 600);
  });

  it('não invalida no ERRO (mutationFn rejeita)', async () => {
    mockUploadFoto.mockRejectedValue(Object.assign(new Error('413'), { status: 413 }));
    const { qc, wrapper } = makeWrapperComCliente();
    const spy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUploadFotoPet(), { wrapper });
    result.current.mutate({ idPet: ID_PET, uriOriginal: URI_PICKER_ORIGINAL });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(spy).not.toHaveBeenCalled();
  });
});
