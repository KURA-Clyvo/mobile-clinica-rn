import type { InternalAxiosRequestConfig } from 'axios';
import type { PetFotoResponse, PetResponse, TimelineEventResponse } from '../types/api';

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

const PETS: PetResponse[] = [
  {
    id: 1,
    nmPet: 'Thor',
    nmEspecie: 'Cão',
    nmRaca: 'Labrador Retriever',
    dtNascimento: '2020-03-15T00:00:00.000Z',
    sgSexo: 'M',
    sgPorte: 'G',
    tutores: [{ id: 10, nmTutor: 'Carlos Mendes', dsTelefone: '11999990001', dsEmail: 'carlos.mendes@email.com' }],
    // FT-08: pet COM foto no mock — prova visual dos 2 casos (com/sem foto)
    // no modo mock. Formato espelha o real (FT-04): variantes 256/1080,
    // mesma chave, query de assinatura fake (o mock-adapter não valida sig).
    dsFotoUrl: 'https://picsum.photos/seed/thor/1080',
    dsFotoThumbUrl: 'https://picsum.photos/seed/thor/256',
  },
  {
    id: 2,
    nmPet: 'Mel',
    nmEspecie: 'Cão',
    nmRaca: 'Golden Retriever',
    dtNascimento: '2019-07-22T00:00:00.000Z',
    sgSexo: 'F',
    sgPorte: 'G',
    tutores: [{ id: 11, nmTutor: 'Patrícia Souza', dsTelefone: '11999990002', dsEmail: 'patricia.s@email.com' }],
    dsFotoUrl: 'https://picsum.photos/seed/mel/1080',
    dsFotoThumbUrl: 'https://picsum.photos/seed/mel/256',
  },
  {
    id: 3,
    nmPet: 'Simba',
    nmEspecie: 'Gato',
    nmRaca: 'Siamês',
    dtNascimento: '2021-11-05T00:00:00.000Z',
    sgSexo: 'M',
    sgPorte: 'M',
    tutores: [{ id: 12, nmTutor: 'Ana Paula Rodrigues', dsTelefone: '11999990003', dsEmail: 'anapaula.r@email.com' }],
  },
  {
    id: 4,
    nmPet: 'Nina',
    nmEspecie: 'Cão',
    nmRaca: 'Border Collie',
    dtNascimento: '2022-01-18T00:00:00.000Z',
    sgSexo: 'F',
    sgPorte: 'M',
    tutores: [
      { id: 13, nmTutor: 'Marcos Oliveira', dsTelefone: '11999990004', dsEmail: 'marcos.oli@email.com' },
      { id: 14, nmTutor: 'Fernanda Oliveira', dsTelefone: '11999990014', dsEmail: 'feroliveira@email.com' },
    ],
  },
  {
    id: 5,
    nmPet: 'Pipoca',
    nmEspecie: 'Cão',
    nmRaca: 'Poodle Toy',
    dtNascimento: '2023-04-30T00:00:00.000Z',
    sgSexo: 'F',
    sgPorte: 'P',
    tutores: [{ id: 15, nmTutor: 'Beatriz Santos', dsTelefone: '11999990005', dsEmail: 'bia.santos@email.com' }],
  },
  {
    id: 6,
    nmPet: 'Perola',
    nmEspecie: 'Gato',
    nmRaca: 'Persa',
    dtNascimento: '2020-09-12T00:00:00.000Z',
    sgSexo: 'F',
    sgPorte: 'M',
    tutores: [{ id: 16, nmTutor: 'Juliana Costa', dsTelefone: '11999990006', dsEmail: 'ju.costa@email.com' }],
  },
  {
    id: 7,
    nmPet: 'Bolinha',
    nmEspecie: 'Cão',
    nmRaca: 'SRD',
    dtNascimento: '2018-06-01T00:00:00.000Z',
    sgSexo: 'M',
    sgPorte: 'M',
    tutores: [],
  },
  {
    id: 8,
    nmPet: 'Zeus',
    nmEspecie: 'Cão',
    nmRaca: 'Husky Siberiano',
    dtNascimento: '2021-02-14T00:00:00.000Z',
    sgSexo: 'M',
    sgPorte: 'G',
    tutores: [{ id: 17, nmTutor: 'Pedro Alves', dsTelefone: '11999990007', dsEmail: 'pedro.alves@email.com' }],
  },
  {
    id: 9,
    nmPet: 'Buldogue',
    nmEspecie: 'Cão',
    nmRaca: 'Bulldog Francês',
    dtNascimento: '2022-08-20T00:00:00.000Z',
    sgSexo: 'M',
    sgPorte: 'P',
    tutores: [{ id: 18, nmTutor: 'Gabriela Ferreira', dsTelefone: '11999990008', dsEmail: 'gabi.f@email.com' }],
  },
  {
    id: 10,
    nmPet: 'Charlie',
    nmEspecie: 'Cão',
    nmRaca: 'Beagle',
    dtNascimento: '2019-12-25T00:00:00.000Z',
    sgSexo: 'M',
    sgPorte: 'M',
    tutores: [{ id: 19, nmTutor: 'Lucas Barbosa', dsTelefone: '11999990009', dsEmail: 'lucas.b@email.com' }],
  },
  {
    id: 11,
    nmPet: 'Mila',
    nmEspecie: 'Gato',
    nmRaca: 'Maine Coon',
    dtNascimento: '2020-05-10T00:00:00.000Z',
    sgSexo: 'F',
    sgPorte: 'G',
    tutores: [{ id: 20, nmTutor: 'Rafaela Martins', dsTelefone: '11999990010', dsEmail: 'rafa.m@email.com' }],
  },
  {
    id: 12,
    nmPet: 'Biscuit',
    nmEspecie: 'Cão',
    nmRaca: 'Yorkshire Terrier',
    dtNascimento: '2023-01-08T00:00:00.000Z',
    sgSexo: 'F',
    sgPorte: 'P',
    tutores: [{ id: 21, nmTutor: 'Thiago Nascimento', dsTelefone: '11999990011', dsEmail: 'thiago.n@email.com' }],
  },
];

const TIMELINES: Record<number, TimelineEventResponse[]> = {
  1: [
    { idEventoClinico: 1001, nmTipo: 'CONSULTA', dtEvento: daysAgo(2), dsObservacao: 'Consulta pós-operatória. Animal em boa evolução.', nmVeterinario: 'Dr. Felipe Ferrete' },
    { idEventoClinico: 1002, nmTipo: 'PRESCRICAO', dtEvento: daysAgo(2), dsObservacao: 'Amoxicilina 500mg — 1 comp 12/12h por 7 dias.', nmVeterinario: 'Dr. Felipe Ferrete' },
    { idEventoClinico: 1003, nmTipo: 'EXAME', dtEvento: daysAgo(5), dsObservacao: 'Hemograma completo — resultados dentro da normalidade.', nmVeterinario: 'Dr. Felipe Ferrete' },
    { idEventoClinico: 1004, nmTipo: 'CONSULTA', dtEvento: daysAgo(10), dsObservacao: 'Consulta pré-operatória. Aprovado para cirurgia.', nmVeterinario: 'Dr. Felipe Ferrete' },
    { idEventoClinico: 1005, nmTipo: 'VACINA', dtEvento: daysAgo(30), dsObservacao: 'V10 aplicada. Próxima dose em 12 meses.', nmVeterinario: 'Dr. Felipe Ferrete' },
    { idEventoClinico: 1006, nmTipo: 'TELEORIENTACAO', dtEvento: daysAgo(45), dsObservacao: 'Tutor relatou tosse seca. Orientado a trazer para consulta presencial.', nmVeterinario: 'Dr. Felipe Ferrete' },
    { idEventoClinico: 1007, nmTipo: 'CONSULTA', dtEvento: daysAgo(60), dsObservacao: 'Check-up anual. Sem alterações.', nmVeterinario: 'Dr. Felipe Ferrete' },
    { idEventoClinico: 1008, nmTipo: 'VACINA', dtEvento: daysAgo(365), dsObservacao: 'Antirrábica aplicada.', nmVeterinario: 'Dr. Felipe Ferrete' },
  ],
};

export async function list(_config: InternalAxiosRequestConfig): Promise<PetResponse[]> {
  return PETS;
}

export async function byId(config: InternalAxiosRequestConfig): Promise<PetResponse> {
  const url = config.url ?? '';
  const match = /\/pets\/(\d+)$/.exec(url);
  const id = match ? parseInt(match[1] ?? '0', 10) : 0;
  const pet = PETS.find((p) => p.id === id);
  if (!pet) {
    const err: { status: number; code: string; message: string } = {
      status: 404,
      code: 'NOT_FOUND',
      message: `Pet com ID ${id} não encontrado`,
    };
    return Promise.reject(err);
  }
  return pet;
}

export async function timeline(config: InternalAxiosRequestConfig): Promise<TimelineEventResponse[]> {
  const url = config.url ?? '';
  const match = /\/pets\/(\d+)\/timeline$/.exec(url);
  const id = match ? parseInt(match[1] ?? '0', 10) : 0;
  return TIMELINES[id] ?? [];
}

/**
 * FT-07 (regra v5 — o mock é o 2º consumidor do service): `POST
 * /api/v1/pets/{id}/foto` real (FT-03) devolve 200 com `idPet`,
 * `dsFotoChave` e `dtFotoAtualizacao` (PetFotoResponseDto.cs:10, backend
 * `5adb9e5` — fix wave G2, m-2). Este handler NÃO lança e NÃO inspeciona o
 * `FormData` (o mock-adapter não decodifica multipart) — só confirma o
 * shape cru que o service espera de volta, para o par service×mock
 * executar sem exceção sob `EXPO_PUBLIC_USE_MOCKS=true` (G4b).
 */
export async function uploadFoto(config: InternalAxiosRequestConfig): Promise<PetFotoResponse> {
  const url = config.url ?? '';
  const match = /\/pets\/(\d+)\/foto$/.exec(url);
  const id = match ? parseInt(match[1] ?? '0', 10) : 0;
  const pet = PETS.find((p) => p.id === id);
  if (!pet) {
    const err: { status: number; code: string; message: string } = {
      status: 404,
      code: 'NOT_FOUND',
      message: `Pet com ID ${id} não encontrado`,
    };
    return Promise.reject(err);
  }
  return {
    idPet: id,
    dsFotoChave: `clinica/1/pet/${id}/${Date.now()}.webp`,
    dtFotoAtualizacao: new Date().toISOString(),
  };
}
