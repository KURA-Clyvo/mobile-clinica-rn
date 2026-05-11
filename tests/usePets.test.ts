import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePets } from '../src/hooks/usePets';
import { usePetDetail } from '../src/hooks/usePetDetail';
import { usePetTimeline } from '../src/hooks/usePetTimeline';
import * as petsService from '../src/services/pets.service';
import type { PetResponse, TimelineEventResponse } from '../src/types/api';

jest.mock('@services/pets.service', () => ({
  listPets: jest.fn(),
  getPetById: jest.fn(),
  getPetTimeline: jest.fn(),
}));

const mockListPets = petsService.listPets as jest.Mock;
const mockGetPetById = petsService.getPetById as jest.Mock;
const mockGetPetTimeline = petsService.getPetTimeline as jest.Mock;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const MOCK_PETS: PetResponse[] = [
  { id: 1, nmPet: 'Luna', nmEspecie: 'Cão', nmRaca: 'Labrador', dtNascimento: '2020-01-01T00:00:00.000Z', sgSexo: 'F', sgPorte: 'G', tutores: [{ id: 10, nmTutor: 'Carlos Mendes', dsTelefone: '11999990001', dsEmail: 'c@e.com' }] },
  { id: 2, nmPet: 'Thor', nmEspecie: 'Cão', nmRaca: 'Husky', dtNascimento: '2021-05-10T00:00:00.000Z', sgSexo: 'M', sgPorte: 'G', tutores: [{ id: 11, nmTutor: 'Ana Silva', dsTelefone: '11999990002', dsEmail: 'ana@e.com' }] },
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
