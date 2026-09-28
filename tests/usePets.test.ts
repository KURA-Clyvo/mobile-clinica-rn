import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePets, useCriarPet } from '../src/hooks/usePets';
import { usePetDetail } from '../src/hooks/usePetDetail';
import { usePetTimeline } from '../src/hooks/usePetTimeline';
import * as petsService from '../src/services/pets.service';
import type { NovoPetInput, PetResponse, TimelineEventResponse } from '../src/types/api';

jest.mock('@services/pets.service', () => ({
  listPets: jest.fn(),
  getPetById: jest.fn(),
  getPetTimeline: jest.fn(),
  criarPet: jest.fn(),
}));

const mockListPets = petsService.listPets as jest.Mock;
const mockGetPetById = petsService.getPetById as jest.Mock;
const mockGetPetTimeline = petsService.getPetTimeline as jest.Mock;
const mockCriarPet = petsService.criarPet as jest.Mock;

function makeWrapper(qcCompartilhado?: QueryClient) {
  const qc = qcCompartilhado ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const MOCK_PETS: PetResponse[] = [
  { id: 1, nmPet: 'Luna', nmEspecie: 'Cão', nmRaca: 'Labrador', dtNascimento: '2020-01-01T00:00:00.000Z', sgSexo: 'F', sgPorte: 'G', tutores: [{ idTutor: 10, nmTutor: 'Carlos Mendes', dsVinculo: 'PROPRIETARIO', stPrincipal: true }] },
  { id: 2, nmPet: 'Thor', nmEspecie: 'Cão', nmRaca: 'Husky', dtNascimento: '2021-05-10T00:00:00.000Z', sgSexo: 'M', sgPorte: 'G', tutores: [{ idTutor: 11, nmTutor: 'Ana Silva', dsVinculo: 'PROPRIETARIO', stPrincipal: true }] },
  { id: 3, nmPet: 'Mel', nmEspecie: 'Gato', nmRaca: 'Persa', dtNascimento: '2019-07-22T00:00:00.000Z', sgSexo: 'F', sgPorte: 'M', tutores: [] },
];

beforeEach(() => jest.clearAllMocks());

describe('usePets', () => {
  it('returns all 12 pets when no filter', async () => {
    mockListPets.mockResolvedValue(MOCK_PETS);
    const { result } = renderHook(() => usePets(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(3);
    expect(mockListPets).toHaveBeenCalledWith(undefined);
  });

  it('passes filter to listPets — filters by pet name (case-insensitive)', async () => {
    const filtered = MOCK_PETS.filter((p) => p.nmPet.toLowerCase().includes('luna'));
    mockListPets.mockResolvedValue(filtered);
    const { result } = renderHook(() => usePets('luna'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockListPets).toHaveBeenCalledWith('luna');
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.nmPet).toBe('Luna');
  });

  it('passes filter to listPets — filters by tutor name', async () => {
    const filtered = MOCK_PETS.filter((p) =>
      p.tutores.some((t) => t.nmTutor.toLowerCase().includes('silva')),
    );
    mockListPets.mockResolvedValue(filtered);
    const { result } = renderHook(() => usePets('silva'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.tutores[0]?.nmTutor).toContain('Silva');
  });
});

describe('usePetDetail', () => {
  it('is disabled when id is null', () => {
    const { result } = renderHook(() => usePetDetail(null), { wrapper: makeWrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetPetById).not.toHaveBeenCalled();
  });

  it('is disabled when id is 0', () => {
    const { result } = renderHook(() => usePetDetail(0), { wrapper: makeWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetPetById).not.toHaveBeenCalled();
  });

  it('fetches pet when id is valid', async () => {
    mockGetPetById.mockResolvedValue(MOCK_PETS[0]);
    const { result } = renderHook(() => usePetDetail(1), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.nmPet).toBe('Luna');
  });

  it('sets isError=true on 404', async () => {
    mockGetPetById.mockRejectedValue({ status: 404, code: 'NOT_FOUND', message: 'Pet não encontrado' });
    const { result } = renderHook(() => usePetDetail(999), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
  });
});

describe('usePetTimeline', () => {
  const EVENTS: TimelineEventResponse[] = [
    { idEventoClinico: 1, nmTipo: 'CONSULTA', dtEvento: new Date(Date.now() - 2 * 86400000).toISOString(), dsObservacao: 'Check-up', nmVeterinario: 'Dr. Test' },
    { idEventoClinico: 2, nmTipo: 'VACINA', dtEvento: new Date(Date.now() - 30 * 86400000).toISOString(), dsObservacao: 'V10', nmVeterinario: 'Dr. Test' },
    { idEventoClinico: 3, nmTipo: 'EXAME', dtEvento: new Date(Date.now() - 5 * 86400000).toISOString(), dsObservacao: 'Hemograma', nmVeterinario: 'Dr. Test' },
  ];

  it('returns events sorted by date desc', async () => {
    mockGetPetTimeline.mockResolvedValue(EVENTS);
    const { result } = renderHook(() => usePetTimeline(1), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const dates = result.current.data?.map((e) => new Date(e.dtEvento).getTime()) ?? [];
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]!).toBeGreaterThanOrEqual(dates[i]!);
    }
  });

  it('is disabled when id is null', () => {
    const { result } = renderHook(() => usePetTimeline(null), { wrapper: makeWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetPetTimeline).not.toHaveBeenCalled();
  });
});

// REC-04 — aceite: "o paciente novo aparece na lista sem recarregar:
// invalidação do cache do React Query testada (mordida: tirar a
// invalidação)". `usePets` e `useCriarPet` compartilham o MESMO
// QueryClient aqui de propósito — é a única forma de OBSERVAR uma
// invalidação de verdade (query ativa, com observer montado, refetcha
// sozinha quando fica stale; um QueryClient novo por hook não provaria
// nada, porque cada um teria seu próprio cache isolado).
const NOVO_PET_INPUT: NovoPetInput = {
  idTutor: 77,
  idEspecie: 1,
  idRaca: 1,
  nmPet: 'Bidu',
  dtNascimento: '2023-01-01T00:00:00.000Z',
  sgSexo: 'M',
  sgPorte: 'P',
};
const NOVO_PET_RESPOSTA: PetResponse = {
  id: 999,
  nmPet: 'Bidu',
  nmEspecie: 'Cão',
  nmRaca: 'SRD',
  dtNascimento: NOVO_PET_INPUT.dtNascimento,
  sgSexo: 'M',
  sgPorte: 'P',
  tutores: [{ idTutor: 77, nmTutor: 'Ana Beatriz', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
};

describe('useCriarPet — invalida a lista de pets ao salvar (REC-04)', () => {
  it('invalida ["pets"], disparando refetch automático da lista já montada (sem recarregar manualmente)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(qc);

    mockListPets.mockResolvedValue([]);
    const listaHook = renderHook(() => usePets(), { wrapper });
    await waitFor(() => expect(listaHook.result.current.isLoading).toBe(false));
    expect(mockListPets).toHaveBeenCalledTimes(1);

    mockListPets.mockResolvedValue([NOVO_PET_RESPOSTA]);
    mockCriarPet.mockResolvedValue(NOVO_PET_RESPOSTA);
    const mutacaoHook = renderHook(() => useCriarPet(), { wrapper });
    await act(async () => {
      mutacaoHook.result.current.mutate(NOVO_PET_INPUT);
    });
    await waitFor(() => expect(mutacaoHook.result.current.isSuccess).toBe(true));

    // A invalidação faz a query de `usePets` (ainda montada/observada)
    // refetchar SOZINHA — sem nenhuma chamada manual de `refetch()` deste
    // teste. Esta é a mordida: com `invalidateQueries` removido de
    // `useCriarPet` (usePets.ts), `mockListPets` NUNCA passaria de 1
    // chamada (documentado em rec-04-report.md, número/EXIT antes e depois
    // da mutação real).
    await waitFor(() => expect(mockListPets).toHaveBeenCalledTimes(2));
  });
});
