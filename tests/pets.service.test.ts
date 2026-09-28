// FT-07 (KURA_BACKLOG_FOTO_PET.md, FT-03): POST /api/v1/pets/{id}/foto exige
// EXATAMENTE 2 partes multipart, nomeadas `thumb` e `media` (o backend
// detecta o formato pelos magic bytes e rejeita com 400 se as 2 partes não
// baterem o MESMO formato). Estes testes provam que `uploadFoto` monta essas
// 2 partes com os nomes certos, nos 2 ambientes (nativo e web), e que NUNCA
// fixa `Content-Type` manualmente (o que apagaria o boundary do multipart —
// ver comentário em pets.service.ts::uploadFoto).
jest.mock('@services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  lunaClient: { get: jest.fn(), post: jest.fn() },
}));

import { Platform } from 'react-native';
import { apiClient } from '../src/services/api/client';
import { criarPet, uploadFoto } from '../src/services/pets.service';
import type { FotoVarianteGerada } from '../src/utils/fotoPet';
import type { NovoPetInput, PetFotoResponse, PetResponse } from '../src/types/api';

const mockApiPost = apiClient.post as jest.Mock;
const plataformaOriginal = Platform.OS;

const THUMB: FotoVarianteGerada = {
  uri: 'file:///cache/pet-9-thumb.webp',
  fileName: 'pet-9-thumb.webp',
  mimeType: 'image/webp',
};
const MEDIA: FotoVarianteGerada = {
  uri: 'file:///cache/pet-9-media.webp',
  fileName: 'pet-9-media.webp',
  mimeType: 'image/webp',
};
const RESPOSTA: PetFotoResponse = {
  idPet: 9,
  dsFotoChave: 'clinica/1/pet/9/ab12.webp',
  dtFotoAtualizacao: '2026-09-25T12:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApiPost.mockResolvedValue({ data: RESPOSTA });
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: plataformaOriginal, configurable: true });
});

describe('uploadFoto — nativo (iOS/Android)', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });

  it('envia EXATAMENTE 2 partes, nomeadas thumb e media', async () => {
    const formDataSpy = jest.spyOn(FormData.prototype, 'append');

    await uploadFoto(9, THUMB, MEDIA);

    expect(formDataSpy).toHaveBeenCalledTimes(2);
    const nomesDasPartes = formDataSpy.mock.calls.map((chamada) => chamada[0]);
    expect(nomesDasPartes).toEqual(['thumb', 'media']);
  });

  it('MORDIDA: cada parte carrega a variante MANIPULADA que recebeu (uri/nome/tipo), não um placeholder', async () => {
    const formDataSpy = jest.spyOn(FormData.prototype, 'append');

    await uploadFoto(9, THUMB, MEDIA);

    const [chamadaThumb, chamadaMedia] = formDataSpy.mock.calls;
    expect(chamadaThumb![1]).toMatchObject({
      uri: THUMB.uri,
      name: THUMB.fileName,
      type: THUMB.mimeType,
    });
    expect(chamadaMedia![1]).toMatchObject({
      uri: MEDIA.uri,
      name: MEDIA.fileName,
      type: MEDIA.mimeType,
    });
  });

  it('chama POST /api/v1/pets/{id}/foto e devolve o corpo cru (dsFotoChave/dtFotoAtualizacao)', async () => {
    const resultado = await uploadFoto(9, THUMB, MEDIA);

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockApiPost.mock.calls[0]![0]).toBe('/api/v1/pets/9/foto');
    expect(mockApiPost.mock.calls[0]![1]).toBeInstanceOf(FormData);
    expect(resultado).toEqual(RESPOSTA);
  });

  it('NÃO fixa Content-Type manualmente (forçar o header sem boundary quebra o parsing do servidor)', async () => {
    await uploadFoto(9, THUMB, MEDIA);

    const config = mockApiPost.mock.calls[0]![2] as { headers?: Record<string, string> } | undefined;
    const contentType = config?.headers?.['Content-Type'] ?? config?.headers?.['content-type'];
    expect(contentType).toBeUndefined();
  });

  // Fix wave G2 (m-4): a revogação de blob: URL só faz sentido na web — no
  // nativo `thumb.uri`/`media.uri` são caminhos de arquivo real (`file://`),
  // não URLs do navegador.
  it('NÃO chama URL.revokeObjectURL no nativo', async () => {
    const revokeSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await uploadFoto(9, THUMB, MEDIA);

    expect(revokeSpy).not.toHaveBeenCalled();
    revokeSpy.mockRestore();
  });
});

describe('uploadFoto — web (FormData precisa de Blob de verdade)', () => {
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('busca a blob: URL via fetch e anexa o Blob (não o objeto {uri,name,type} do nativo)', async () => {
    const blobThumb = new Blob(['thumb'], { type: THUMB.mimeType });
    const blobMedia = new Blob(['media'], { type: MEDIA.mimeType });
    const fetchMock = jest.fn(async (uri: string) => ({
      blob: async () => (uri === THUMB.uri ? blobThumb : blobMedia),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const formDataSpy = jest.spyOn(FormData.prototype, 'append');

    await uploadFoto(9, THUMB, MEDIA);

    expect(fetchMock).toHaveBeenCalledWith(THUMB.uri);
    expect(fetchMock).toHaveBeenCalledWith(MEDIA.uri);
    expect(formDataSpy).toHaveBeenCalledTimes(2);
    const nomesDasPartes = formDataSpy.mock.calls.map((chamada) => chamada[0]);
    expect(nomesDasPartes).toEqual(['thumb', 'media']);
    expect(formDataSpy.mock.calls[0]![1]).toBe(blobThumb);
    expect(formDataSpy.mock.calls[1]![1]).toBe(blobMedia);
  });

  // Fix wave G2 (m-4, g2-ft07.md M2): thumb.uri/media.uri são blob: URLs na
  // web — o Blob já foi extraído para o FormData no ponto em que o POST
  // termina, então a URL não serve mais pra nada. Revogar evita vazar
  // memória a cada upload.
  it('revoga as blob: URLs (thumb/media) depois do envio', async () => {
    global.fetch = jest.fn(async () => ({
      blob: async () => new Blob(['x'], { type: 'image/webp' }),
    })) as unknown as typeof fetch;
    const revokeSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await uploadFoto(9, THUMB, MEDIA);

    expect(revokeSpy).toHaveBeenCalledWith(THUMB.uri);
    expect(revokeSpy).toHaveBeenCalledWith(MEDIA.uri);
    revokeSpy.mockRestore();
  });

  it('revoga as blob: URLs também quando o POST FALHA (finally, não só o caminho feliz)', async () => {
    global.fetch = jest.fn(async () => ({
      blob: async () => new Blob(['x'], { type: 'image/webp' }),
    })) as unknown as typeof fetch;
    mockApiPost.mockRejectedValueOnce(Object.assign(new Error('413'), { status: 413 }));
    const revokeSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await expect(uploadFoto(9, THUMB, MEDIA)).rejects.toMatchObject({ status: 413 });

    expect(revokeSpy).toHaveBeenCalledWith(THUMB.uri);
    expect(revokeSpy).toHaveBeenCalledWith(MEDIA.uri);
    revokeSpy.mockRestore();
  });
});

// REC-04 — POST /api/v1/pets (PetCreateDto -> PetResponseDto,
// backend-clinica-dotnet origin/main e33da98, ver types/api.ts::
// PetCreateWireDto). O que faz este pet ser "vinculado" ao tutor É o campo
// `idTutor` do corpo — não há uma 2ª chamada de rede pro vínculo (a
// atomicidade da criação já está confirmada na fonte, PetService.
// CreateAsync:53-87). A MORDIDA do aceite ("pet criado sem vínculo ao tutor
// ⇒ teste vermelho, mute a chamada do vínculo") é exercitada aqui como:
// mutar `criarPet` para OMITIR `idTutor` do corpo enviado faz este teste
// falhar — é essa omissão que, do lado do servidor real (e do mock, ver
// tests/pets-novo.mock.test.ts), produziria um pet sem vínculo algum
// (404 "Tutor não encontrado" antes de a linha existir).
describe('criarPet — POST /api/v1/pets envia o vínculo ao tutor no MESMO corpo', () => {
  const INPUT: NovoPetInput = {
    idTutor: 77,
    idEspecie: 1,
    idRaca: 1,
    nmPet: 'Rex',
    dtNascimento: '2022-01-01T00:00:00.000Z',
    sgSexo: 'M',
    sgPorte: 'M',
  };
  const RESPOSTA: PetResponse = {
    id: 500,
    nmPet: 'Rex',
    nmEspecie: 'Cão',
    nmRaca: 'Labrador',
    dtNascimento: INPUT.dtNascimento,
    sgSexo: 'M',
    sgPorte: 'M',
    tutores: [{ idTutor: 77, nmTutor: 'Ana Beatriz', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiPost.mockResolvedValue({ data: RESPOSTA });
  });

  it('chama POST /api/v1/pets com idTutor no corpo (o vínculo) e devolve o pet criado', async () => {
    const resultado = await criarPet(INPUT);

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockApiPost.mock.calls[0]![0]).toBe('/api/v1/pets');
    const corpo = mockApiPost.mock.calls[0]![1] as Record<string, unknown>;
    expect(corpo.idTutor).toBe(77);
    expect(corpo.stPrincipal).toBe(true);
    expect(corpo.dsVinculo).toBe('PROPRIETARIO');
    expect(resultado).toEqual(RESPOSTA);
    // MORDIDA (aceite REC-04, "pet criado sem vínculo ao tutor ⇒ teste
    // vermelho, mute a chamada do vínculo"): esta MESMA asserção
    // (`corpo.idTutor`) é o detector — mutar `criarPet` (pets.service.ts)
    // pra omitir `idTutor: input.idTutor,` do corpo faz este teste falhar
    // (`corpo.idTutor` vira `undefined`). Mordida real feita e restaurada
    // nesta sessão (git diff --stat confirmado antes/depois) — número/EXIT
    // documentados em rec-04-report.md, não duplicados aqui como 2º teste
    // idêntico.
  });
});
