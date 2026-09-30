import type { InternalAxiosRequestConfig } from 'axios';
import type { PetCreateWireDto, PetFotoResponse, PetResponse, TimelineEventResponse } from '../types/api';
import { ESPECIES, RACAS } from '../constants/catalogoPets';
import { buscarTutorArmazenadoPorId } from './tutores.mock';

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
    tutores: [{ idTutor: 10, nmTutor: 'Carlos Mendes', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
    // FT-08: pet COM foto no mock — prova visual dos 2 casos (com/sem foto)
    // no modo mock. Fix wave G2 (G2-6): as URLs abaixo são `picsum.photos` —
    // NÃO reproduzem o formato real da FT-04
    // (`/api/v1/fotos/clinica/{idClinica}/pet/{idPet}/{uuid}_{tam}.{ext}
    // ?exp=...&sig=...`, ver `backend-clinica-dotnet` `5adb9e5`); só a
    // resolução (256 menor, 1080 maior) é preservada. Não dá para apontar
    // pro caminho real aqui: em modo mock não existe `.NET` para servir o
    // arquivo, e um caminho fake não carregaria nada — o `onError` cairia
    // direto na ilustração, sem valor nenhum de demonstração visual.
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
    tutores: [{ idTutor: 11, nmTutor: 'Patrícia Souza', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
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
    tutores: [{ idTutor: 12, nmTutor: 'Ana Paula Rodrigues', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
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
      { idTutor: 13, nmTutor: 'Marcos Oliveira', dsVinculo: 'PROPRIETARIO', stPrincipal: true },
      // Co-tutor: mesmo shape do TutorVinculoDto real (StPrincipal só é true pro
      // vínculo principal — AdicionarTutorAsync sempre grava false, ver anchor de
      // PetService.cs no comentário de PetTutorVinculo, types/api.ts).
      { idTutor: 14, nmTutor: 'Fernanda Oliveira', dsVinculo: 'CUIDADOR', stPrincipal: false },
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
    tutores: [{ idTutor: 15, nmTutor: 'Beatriz Santos', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
  },
  {
    id: 6,
    nmPet: 'Perola',
    nmEspecie: 'Gato',
    nmRaca: 'Persa',
    dtNascimento: '2020-09-12T00:00:00.000Z',
    sgSexo: 'F',
    sgPorte: 'M',
    tutores: [{ idTutor: 16, nmTutor: 'Juliana Costa', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
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
    tutores: [{ idTutor: 17, nmTutor: 'Pedro Alves', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
  },
  {
    id: 9,
    nmPet: 'Buldogue',
    nmEspecie: 'Cão',
    nmRaca: 'Bulldog Francês',
    dtNascimento: '2022-08-20T00:00:00.000Z',
    sgSexo: 'M',
    sgPorte: 'P',
    tutores: [{ idTutor: 18, nmTutor: 'Gabriela Ferreira', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
  },
  {
    id: 10,
    nmPet: 'Charlie',
    nmEspecie: 'Cão',
    nmRaca: 'Beagle',
    dtNascimento: '2019-12-25T00:00:00.000Z',
    sgSexo: 'M',
    sgPorte: 'M',
    tutores: [{ idTutor: 19, nmTutor: 'Lucas Barbosa', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
  },
  {
    id: 11,
    nmPet: 'Mila',
    nmEspecie: 'Gato',
    nmRaca: 'Maine Coon',
    dtNascimento: '2020-05-10T00:00:00.000Z',
    sgSexo: 'F',
    sgPorte: 'G',
    tutores: [{ idTutor: 20, nmTutor: 'Rafaela Martins', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
  },
  {
    id: 12,
    nmPet: 'Biscuit',
    nmEspecie: 'Cão',
    nmRaca: 'Yorkshire Terrier',
    dtNascimento: '2023-01-08T00:00:00.000Z',
    sgSexo: 'F',
    sgPorte: 'P',
    tutores: [{ idTutor: 21, nmTutor: 'Thiago Nascimento', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
  },
  // REC-14 — MESMO pet que `luna.mock.ts::TRIAGENS_FIXTURE` (item 501, tutor "Ana
  // Beatriz"/id 201, já acrescentado a `tutores.mock.ts::buildTutoresArmazenados`) usa
  // para "Rex" (id 301). Sem esta entrada, o formulário de agendamento aberto pelo botão
  // "Agendar" da fila não teria NENHUM pet real para oferecer ao escolher o pet daquele
  // tutor (E34 — a triagem não sabe o pet, a recepção escolhe na hora).
  {
    id: 301,
    nmPet: 'Rex',
    nmEspecie: 'Cão',
    nmRaca: 'Vira-lata',
    dtNascimento: '2021-05-10T00:00:00.000Z',
    sgSexo: 'M',
    sgPorte: 'M',
    tutores: [{ idTutor: 201, nmTutor: 'Ana Beatriz', dsVinculo: 'PROPRIETARIO', stPrincipal: true }],
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

function rejeitar(status: number, code: string, message: string): Promise<never> {
  return Promise.reject({ status, code, message });
}

function rejeitarValidacao(message: string, details: Record<string, string[]>): Promise<never> {
  return Promise.reject({ status: 400, code: 'VALIDACAO', message, details });
}

function parseBody<T>(config: InternalAxiosRequestConfig): T {
  return (typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})) as T;
}

let _proximoIdPet = 100;

/**
 * REC-04 — POST /api/v1/pets (2º consumidor do shape de fio, regra v5):
 * espelha `PetCreateValidator.cs` (backend-clinica-dotnet, origin/main
 * e33da98) e o comportamento de `PetService.CreateAsync` — em especial, o
 * VÍNCULO ao tutor é o que torna este pet "cadastrado com sucesso": um
 * `idTutor` ausente/inexistente rejeita com 404, exatamente como o real
 * (`EntidadeNaoEncontradaException("Tutor", dto.IdTutor)`), NUNCA cria o
 * pet órfão. É este 404 que a mordida "pet criado sem vínculo" do brief
 * exercita do lado do teste de service (mutar `criarPet` para omitir
 * `idTutor` do corpo faz este handler achar `body.idTutor === undefined`,
 * `buscarTutorArmazenadoPorId(undefined)` não acha ninguém, rejeita).
 */
export async function criar(config: InternalAxiosRequestConfig): Promise<PetResponse> {
  const body = parseBody<PetCreateWireDto>(config);

  if (!body.idEspecie || body.idEspecie <= 0) {
    return rejeitarValidacao('Um ou mais campos são inválidos.', {
      IdEspecie: ["'Id Especie' deve ser maior que '0'."],
    });
  }
  if (!body.idRaca || body.idRaca <= 0) {
    return rejeitarValidacao('Um ou mais campos são inválidos.', {
      IdRaca: ["'Id Raca' deve ser maior que '0'."],
    });
  }
  if (!body.nmPet || !body.nmPet.trim()) {
    return rejeitarValidacao('Um ou mais campos são inválidos.', {
      NmPet: ["'Nm Pet' não pode estar vazio."],
    });
  }
  if (body.dtNascimento && new Date(body.dtNascimento).getTime() > Date.now()) {
    return rejeitarValidacao('Um ou mais campos são inválidos.', {
      DtNascimento: ["'DtNascimento' não pode ser uma data futura."],
    });
  }
  if (body.sgSexo !== 'M' && body.sgSexo !== 'F') {
    return rejeitarValidacao('Um ou mais campos são inválidos.', {
      SgSexo: ["'Sg Sexo' deve ser 'M' ou 'F'."],
    });
  }
  if (!['P', 'M', 'G'].includes(body.sgPorte)) {
    return rejeitarValidacao('Um ou mais campos são inválidos.', {
      SgPorte: ["'Sg Porte' deve ser 'P', 'M' ou 'G'."],
    });
  }

  // O VÍNCULO: sem tutor real, sem pet criado — mesmo comportamento do
  // PetService.CreateAsync real (404, ver JSDoc acima).
  const tutor = buscarTutorArmazenadoPorId(body.idTutor);
  if (!tutor) {
    return rejeitar(404, 'NOT_FOUND', `Tutor com id ${body.idTutor} não encontrado`);
  }

  const especie = ESPECIES.find((e) => e.id === body.idEspecie);
  const raca = RACAS.find((r) => r.id === body.idRaca);

  const novo: PetResponse = {
    id: _proximoIdPet++,
    nmPet: body.nmPet.trim(),
    nmEspecie: especie?.nome ?? `Espécie ${body.idEspecie}`,
    nmRaca: raca?.nome ?? `Raça ${body.idRaca}`,
    dtNascimento: body.dtNascimento,
    sgSexo: body.sgSexo,
    sgPorte: body.sgPorte,
    // REC-04 fix wave (G2, I-3): shape REAL do TutorVinculoDto — ver anchor em
    // types/api.ts::PetTutorVinculo. `stPrincipal`/`dsVinculo` espelham o que
    // `criarPet` sempre envia (PetForm.tsx: `stPrincipal: true, dsVinculo:
    // 'PROPRIETARIO'`), não um valor fixo re-adivinhado aqui.
    tutores: [
      {
        idTutor: tutor.id,
        nmTutor: tutor.nmTutor,
        dsVinculo: body.dsVinculo,
        stPrincipal: body.stPrincipal,
      },
    ],
  };
  PETS.push(novo);
  return novo;
}

// GET /api/v1/pets$ | POST /api/v1/pets$ — mesma URL, 2 métodos (mesmo
// padrão de usuarios-clinica.mock.ts::colecao — ver ordem em
// mock-adapter.ts). GET lista (pré-existente), POST cadastra (REC-04).
export async function colecao(
  config: InternalAxiosRequestConfig,
): Promise<PetResponse[] | PetResponse> {
  if ((config.method ?? 'get').toUpperCase() === 'POST') {
    return criar(config);
  }
  return list(config);
}

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

// REC-14 — exportado para `agenda.mock.ts::criarAgendamento` resolver
// nome/vínculo do pet ao montar a resposta de `POST /agendamentos` (mesmo
// padrão de `tutores.mock.ts::buscarTutorArmazenadoPorId`, reaproveitado
// por `pets.mock.ts::criar` acima). Devolve `undefined` quando o id não
// existe — o chamador decide o que fazer (404, mesma semântica do
// `AgendaService.CriarAsync` real recusando `IdPet` desconhecido).
export function buscarPetArmazenadoPorId(id: number): PetResponse | undefined {
  return PETS.find((p) => p.id === id);
}
