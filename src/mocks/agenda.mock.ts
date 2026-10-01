import type { InternalAxiosRequestConfig } from 'axios';
import type {
  AgendaApiResponseDto,
  AgendamentoItemApiDto,
  AgendamentoCreateWireDto,
} from '../services/agenda.service';
import { TIPOS_AGENDAMENTO_PERMITIDOS, AGENDAMENTO_OBSERVACOES_MAX_BYTES } from '../services/agenda.service';
import { buscarTutorArmazenadoPorId } from './tutores.mock';
import { buscarPetArmazenadoPorId } from './pets.mock';
import { buscarVeterinarioArmazenadoPorId } from './veterinarios.mock';
import { buscarTriagemMockPorId } from './luna.mock';

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function makeDate(base: Date, dayOffset: number, hour: number, minute = 0): string {
  const d = new Date(base);
  d.setDate(base.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// REC-12 — timestamps de check-in/início são gravados pelo backend em hora
// LOCAL de SP (A-5, IRelogioClinica), sem sufixo `Z`/offset — diferente de
// `makeDate` acima (que usa `toISOString()`, UTC, para os agendamentos da
// visão Semana pré-existente). Um mock de check-in/início precisa da MESMA
// forma naive que o servidor produz, senão `minutosEsperando` (etapaRecepcao.ts)
// interpretaria um horário deslocado pelo fuso ao rodar num aparelho fora
// de UTC.
function naiveLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function minutosAtras(minutos: number): Date {
  return new Date(Date.now() - minutos * 60_000);
}

// REC-12 — a etapa REAL é derivada no servidor (A-3, AgendaService.
// CalcularEtapaRecepcao). O mock não pode importar aquele código (vive no
// outro repo) nem duplicar a tabela de precedência linha a linha — só
// precisa de uma aproximação PLAUSÍVEL para os agendamentos da visão Semana
// pré-existente (que não carregam check-in/início nenhum, então a única
// entrada que importa é o `dsStatus`). Os itens dedicados da visão "Hoje"
// (buildTodayReceptionAppointments, abaixo) declaram `dsEtapaRecepcao`
// EXPLICITAMENTE, sem passar por este helper.
function etapaMockParaStatus(dsStatus: string): string {
  switch (dsStatus) {
    case 'REALIZADO':
      return 'FINALIZADO';
    case 'CANCELADO':
      return 'CANCELADO';
    case 'NAO_COMPARECEU':
      return 'NAO_COMPARECEU';
    case 'CONFIRMADO':
      return 'CONFIRMADO';
    default:
      return 'AGENDADO';
  }
}

// TASK-65 (FIX_5): devolve AgendamentoItemApiDto[] (shape RAW do .NET, campos
// idAgendamento/dtAgendamento/duracaoMinutos/dsStatus) — não mais AgendamentoResponse[]
// (tipo app-facing produzido por mapAgendamentoItem). `dsStatus` usa os valores REAIS
// de ST_STATUS (CHK_AGEND_STATUS: INTENCAO/AGENDADO/CONFIRMADO/REALIZADO/CANCELADO/
// NAO_COMPARECEU — ver comentário em agenda.service.ts), não os já traduzidos
// (AGENDADA/EM_ANDAMENTO/CONCLUIDA/CANCELADA) que o mock antigo continha. `dsObservacao`
// não existe em AgendamentoItemApiDto — mapAgendamentoItem já documenta que o campo
// fica sempre undefined (o DTO real não traz observações).
function buildAppointments(): AgendamentoItemApiDto[] {
  const monday = getMonday(new Date());
  const vet = { idVeterinario: 1, nmVeterinario: 'Dr. Felipe Ferrete' };

  // Pré-existentes (visão Semana) — `dsEtapaRecepcao`/`idPet`/`idTutor`/
  // `dsOrigem` acrescentados nesta task (REC-12) via `.map()` abaixo, sem
  // reescrever cada literal: são campos novos e obrigatórios/úteis no wire
  // DTO (ver pin em agenda.service.ts), mas o conteúdo de cada consulta da
  // semana não muda.
  const semana: Omit<AgendamentoItemApiDto, 'dsEtapaRecepcao' | 'idPet' | 'idTutor' | 'dsOrigem'>[] = [
    // Segunda
    { idAgendamento: 1, dtAgendamento: makeDate(monday, 0, 8), duracaoMinutos: 30, dsStatus: 'REALIZADO', nmPet: 'Thor', nmTutor: 'Carlos Mendes', dsTipoConsulta: 'Consulta de Retorno', nrVersion: 1, ...vet },
    { idAgendamento: 2, dtAgendamento: makeDate(monday, 0, 9), duracaoMinutos: 45, dsStatus: 'REALIZADO', nmPet: 'Mel', nmTutor: 'Patrícia Souza', dsTipoConsulta: 'Vacinação', nrVersion: 1, ...vet },
    { idAgendamento: 3, dtAgendamento: makeDate(monday, 0, 14), duracaoMinutos: 30, dsStatus: 'AGENDADO', nmPet: 'Max', nmTutor: 'Roberto Lima', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    // Terça
    { idAgendamento: 4, dtAgendamento: makeDate(monday, 1, 8, 30), duracaoMinutos: 30, dsStatus: 'REALIZADO', nmPet: 'Simba', nmTutor: 'Ana Paula Rodrigues', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    { idAgendamento: 5, dtAgendamento: makeDate(monday, 1, 10), duracaoMinutos: 60, dsStatus: 'CONFIRMADO', nmPet: 'Nina', nmTutor: 'Fernanda Costa', dsTipoConsulta: 'Check-up Anual', nrVersion: 1, ...vet },
    { idAgendamento: 6, dtAgendamento: makeDate(monday, 1, 15), duracaoMinutos: 30, dsStatus: 'AGENDADO', nmPet: 'Bob', nmTutor: 'Lucas Ferreira', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    // Quarta
    { idAgendamento: 7, dtAgendamento: makeDate(monday, 2, 9), duracaoMinutos: 30, dsStatus: 'CONFIRMADO', nmPet: 'Bolinha', nmTutor: 'João Ferreira', dsTipoConsulta: 'Consulta de Retorno', nrVersion: 1, ...vet },
    { idAgendamento: 8, dtAgendamento: makeDate(monday, 2, 11), duracaoMinutos: 45, dsStatus: 'AGENDADO', nmPet: 'Luna', nmTutor: 'Mariana Alves', dsTipoConsulta: 'Vacinação', nrVersion: 1, ...vet },
    { idAgendamento: 9, dtAgendamento: makeDate(monday, 2, 16), duracaoMinutos: 30, dsStatus: 'AGENDADO', nmPet: 'Rex', nmTutor: 'Pedro Henrique', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    // Quinta
    { idAgendamento: 10, dtAgendamento: makeDate(monday, 3, 8), duracaoMinutos: 60, dsStatus: 'AGENDADO', nmPet: 'Mimi', nmTutor: 'Sofia Martins', dsTipoConsulta: 'Check-up Anual', nrVersion: 1, ...vet },
    { idAgendamento: 11, dtAgendamento: makeDate(monday, 3, 14, 30), duracaoMinutos: 30, dsStatus: 'CANCELADO', nmPet: 'Toby', nmTutor: 'Gabriela Lima', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    // Sexta
    { idAgendamento: 12, dtAgendamento: makeDate(monday, 4, 9, 30), duracaoMinutos: 45, dsStatus: 'AGENDADO', nmPet: 'Nala', nmTutor: 'Ricardo Moura', dsTipoConsulta: 'Vacinação', nrVersion: 1, ...vet },
    { idAgendamento: 13, dtAgendamento: makeDate(monday, 4, 11), duracaoMinutos: 30, dsStatus: 'AGENDADO', nmPet: 'Spike', nmTutor: 'Isabela Santos', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    // Sábado
    { idAgendamento: 14, dtAgendamento: makeDate(monday, 5, 8), duracaoMinutos: 30, dsStatus: 'AGENDADO', nmPet: 'Coco', nmTutor: 'Thiago Nascimento', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    { idAgendamento: 15, dtAgendamento: makeDate(monday, 5, 9, 30), duracaoMinutos: 30, dsStatus: 'AGENDADO', nmPet: 'Pingo', nmTutor: 'Camila Ribeiro', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vet },
    // Domingo: sem consultas
  ];

  const semanaCompleta: AgendamentoItemApiDto[] = semana.map((a, i) => ({
    ...a,
    idPet: 100 + i,
    idTutor: 200 + i,
    dsOrigem: 'PORTAL',
    dsEtapaRecepcao: etapaMockParaStatus(a.dsStatus),
  }));

  return [...semanaCompleta, ...buildTodayReceptionAppointments(vet)];
}

// REC-12 — itens dedicados à visão "Hoje" da recepção, cobrindo as 7 etapas
// (A-3) e as 3 origens (`DS_ORIGEM`, A-1), independente de que dia da semana
// seja "hoje" quando o mock rodar (os itens da visão Semana acima só caem em
// "hoje" por coincidência de data). IDs a partir de 16 (a visão Semana usa
// 1-15). Horas fixas ao longo do dia de hoje — `makeHojeAt` usa
// `new Date()` (hoje real), não `monday` (que pode ser semana diferente).
function buildTodayReceptionAppointments(
  vetBase: { idVeterinario: number; nmVeterinario: string },
): AgendamentoItemApiDto[] {
  const hoje = new Date();
  const makeHojeAt = (hour: number, minute = 0): string => {
    const d = new Date(hoje);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  return [
    // AGENDADO, sem check-in, origem PORTAL, com foto.
    {
      idAgendamento: 16, dtAgendamento: makeHojeAt(9), duracaoMinutos: 30, dsStatus: 'AGENDADO',
      nmPet: 'Rex', nmTutor: 'Ana Beatriz', dsTipoConsulta: 'Consulta Geral', nrVersion: 1, ...vetBase,
      idPet: 301, idTutor: 201, dsOrigem: 'PORTAL', dsEtapaRecepcao: 'AGENDADO',
      // REC-17: pet 301/tutor 201 (Rex / Ana Beatriz) EXISTEM em pets.mock/tutores.mock — o "Remarcar"
      // abre o formulário com pet e tutor resolvidos (G2 I-3: 116/216 não existiam => 404 no plano B).
      // REMARCAR NÃO muda o status (LunaService.cs:519-523 @ 81d5a58) — a linha segue AGENDADO.
      dsRespostaConfirmacao: 'REMARCAR',
      dsFotoThumbUrl: 'https://cdn.kura.dev/pets/301/thumb.webp',
    },
    // CONFIRMADO, sem check-in, origem RECEPCAO, sem foto (fallback).
    {
      idAgendamento: 17, dtAgendamento: makeHojeAt(9, 30), duracaoMinutos: 30, dsStatus: 'CONFIRMADO',
      nmPet: 'Bento', nmTutor: 'Caio Ramos', dsTipoConsulta: 'Vacinação', nrVersion: 1, ...vetBase,
      idPet: 117, idTutor: 217, dsOrigem: 'RECEPCAO', dsEtapaRecepcao: 'CONFIRMADO',
      // REC-17: SIM leva o status a CONFIRMADO (LunaService.cs:506-512 @ 81d5a58).
      dsRespostaConfirmacao: 'SIM',
    },
    // CHEGOU (dtCheckin preenchido há ~12min) — origem TRIAGEM_LUNA, urgência ALTA.
    {
      idAgendamento: 18, dtAgendamento: makeHojeAt(10), duracaoMinutos: 30, dsStatus: 'AGENDADO',
      nmPet: 'Nina', nmTutor: 'Diego Farias', dsTipoConsulta: 'Consulta Geral', nrVersion: 2, ...vetBase,
      idPet: 118, idTutor: 218, dsOrigem: 'TRIAGEM_LUNA', dsNivelUrgenciaOrigem: 'ALTA',
      dsEtapaRecepcao: 'CHEGOU', dtCheckin: naiveLocal(minutosAtras(12)),
      dsFotoThumbUrl: 'https://cdn.kura.dev/pets/118/thumb.webp',
    },
    // EM_ATENDIMENTO (check-in + início preenchidos) — origem TRIAGEM_LUNA, urgência MEDIA.
    {
      idAgendamento: 19, dtAgendamento: makeHojeAt(10, 30), duracaoMinutos: 45, dsStatus: 'CONFIRMADO',
      nmPet: 'Zeca', nmTutor: 'Elaine Prado', dsTipoConsulta: 'Check-up Anual', nrVersion: 3, ...vetBase,
      idPet: 119, idTutor: 219, dsOrigem: 'TRIAGEM_LUNA', dsNivelUrgenciaOrigem: 'MEDIA',
      dsEtapaRecepcao: 'EM_ATENDIMENTO',
      dtCheckin: naiveLocal(minutosAtras(25)), dtInicioAtendimento: naiveLocal(minutosAtras(5)),
    },
    // FINALIZADO — origem PORTAL, ciclo completo.
    {
      idAgendamento: 20, dtAgendamento: makeHojeAt(8), duracaoMinutos: 30, dsStatus: 'REALIZADO',
      nmPet: 'Uga', nmTutor: 'Felipe Rocha', dsTipoConsulta: 'Consulta de Retorno', nrVersion: 4, ...vetBase,
      idPet: 120, idTutor: 220, dsOrigem: 'PORTAL', dsEtapaRecepcao: 'FINALIZADO',
      dtCheckin: naiveLocal(minutosAtras(90)), dtInicioAtendimento: naiveLocal(minutosAtras(80)),
    },
    // NAO_COMPARECEU — origem RECEPCAO, horário já passado, nunca chegou.
    {
      idAgendamento: 21, dtAgendamento: makeHojeAt(7, 30), duracaoMinutos: 30, dsStatus: 'NAO_COMPARECEU',
      nmPet: 'Fifi', nmTutor: 'Gustavo Alencar', dsTipoConsulta: 'Vacinação', nrVersion: 2, ...vetBase,
      idPet: 121, idTutor: 221, dsOrigem: 'RECEPCAO', dsEtapaRecepcao: 'NAO_COMPARECEU',
    },
    // CANCELADO — origem TRIAGEM_LUNA, urgência BAIXA.
    {
      idAgendamento: 22, dtAgendamento: makeHojeAt(16), duracaoMinutos: 30, dsStatus: 'CANCELADO',
      nmPet: 'Duke', nmTutor: 'Helena Vidal', dsTipoConsulta: 'Consulta Geral', nrVersion: 2, ...vetBase,
      idPet: 122, idTutor: 222, dsOrigem: 'TRIAGEM_LUNA', dsNivelUrgenciaOrigem: 'BAIXA',
      dsEtapaRecepcao: 'CANCELADO',
      // REC-17: CANCELAR leva o status a CANCELADO (LunaService.cs:514-517 @ 81d5a58); sem selo na UI.
      dsRespostaConfirmacao: 'CANCELAR',
    },
  ];
}

// FM-04 — achado nº 3 do brief: buildAppointments() reconstruía a lista do
// ZERO a cada chamada, então um PATCH em modo mock não sobrevivia ao refetch
// seguinte (a mudança "revertia" na tela, na frente de quem estivesse vendo a
// demo — o modo mock é justamente o caminho que a demo usa por padrão,
// EXPO_PUBLIC_USE_MOCKS=true em .env.example). `_store` é preenchido uma
// única vez (lazy, na primeira chamada) e passa a ser a fonte de verdade
// tanto para `agenda()` (leitura) quanto para `atualizarStatus()` (escrita) —
// o PATCH grava, o GET seguinte lê o que foi gravado.
let _store: AgendamentoItemApiDto[] | null = null;

function getStore(): AgendamentoItemApiDto[] {
  if (!_store) {
    _store = buildAppointments();
  }
  return _store;
}

// Exportado só para teste: `_store` é module-level e o registro de módulos
// do Jest é por ARQUIVO de teste, não por `it()` — sem isto, um PATCH num
// teste vazaria estado para o próximo teste do mesmo arquivo.
export function __resetStoreParaTeste(): void {
  _store = null;
}

export async function agenda(config: InternalAxiosRequestConfig): Promise<AgendaApiResponseDto> {
  const params = config.params as { dataInicio?: string; dataFim?: string } | undefined;
  const all = getStore();

  if (!params?.dataInicio || !params?.dataFim) {
    return { dataInicio: params?.dataInicio ?? '', dataFim: params?.dataFim ?? '', agendamentos: all };
  }

  const start = new Date(params.dataInicio + 'T00:00:00');
  const end = new Date(params.dataFim + 'T23:59:59');

  const agendamentos = all.filter((a) => {
    const dt = new Date(a.dtAgendamento);
    return dt >= start && dt <= end;
  });

  return { dataInicio: params.dataInicio, dataFim: params.dataFim, agendamentos };
}

// FM-04: primeiro handler de PATCH deste repo. Persiste no MESMO `_store` que
// `agenda()` lê — é o que resolve o achado nº 3 (mock stateless).
//
// Só o conflito de concorrência (409) é simulado como erro aqui — é o único
// caso que o brief pede para o app tratar explicitamente (achado nº 5).
// Validação de máquina de estados (422) fica só do lado real do .NET:
// replicá-la aqui duplicaria TRANSICOES_PERMITIDAS (agenda.service.ts) e
// arriscaria divergir dela em silêncio sem que nenhum teste pegasse — o
// próprio app já decide quais botões oferecer a partir da MESMA tabela
// (getTransicoesPermitidas) antes de disparar o PATCH, então uma transição
// inválida não deveria chegar até aqui pelo fluxo normal da UI.
export async function atualizarStatus(
  config: InternalAxiosRequestConfig,
): Promise<AgendamentoItemApiDto> {
  const match = config.url?.match(/\/agendamentos\/(\d+)\/status$/);
  const idAgendamento = match ? Number(match[1]) : 0;
  // FM-04 — achado durante a escrita do teste de contrato (mock-contract-
  // audit.test.ts), não previsto pelo brief: `config.data` chegando pela
  // cadeia REAL (apiClient.patch -> interceptor de mock -> resolveMock) é o
  // OBJETO já, não uma string JSON — `JSON.parse((config.data as string))`
  // (o padrão copiado de auth.mock.ts::register / eventos-clinicos.mock.ts::
  // confirmarSoap) quebra com "[object Object]" is not valid JSON". Os dois
  // mocks copiados NUNCA são exercitados pela cadeia real em nenhum teste
  // deste repo — só via resolveMock() com config montado à mão, que já
  // entrega uma string — então o bug deles ficou latente. Não corrigido
  // aqui (fora do escopo desta task); registrado no relatório da FM-04.
  // Aceita os dois formatos por segurança, já que não é o objetivo desta
  // task provar qual é o comportamento "certo" do axios neste ambiente.
  const body = (typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})) as {
    dsStatus?: string;
    nrVersion?: number;
    dsObservacao?: string;
  };

  const store = getStore();
  const item = store.find((a) => a.idAgendamento === idAgendamento);
  if (!item) {
    return Promise.reject({
      status: 404,
      code: 'NOT_FOUND',
      message: `Agendamento ${idAgendamento} não encontrado`,
    });
  }

  if (typeof body.nrVersion === 'number' && body.nrVersion !== item.nrVersion) {
    return Promise.reject({
      status: 409,
      code: 'CONFLITO_CONCORRENCIA',
      message: `Agendamento ${idAgendamento} foi atualizado por outro processo. Releia antes de tentar de novo.`,
    });
  }

  item.dsStatus = body.dsStatus ?? item.dsStatus;
  item.nrVersion = item.nrVersion + 1;
  // REC-12: mantém dsEtapaRecepcao coerente com o novo dsStatus para quem
  // reler pela visão "Hoje" depois do PATCH — mesma aproximação de
  // etapaMockParaStatus() usada na fixture inicial (não substitui a regra
  // real do servidor, que continua sendo a única autoridade — A-3).
  item.dsEtapaRecepcao = etapaMockParaStatus(item.dsStatus);

  return { ...item };
}

// REC-12 — "Chegou" (check-in). Mesmo padrão de `atualizarStatus` acima:
// persiste no MESMO `_store`, só simula os erros que o app precisa tratar
// explicitamente (409 de versão, 422 de status não elegível) — a máquina de
// estados completa continua sendo autoridade só do lado real do .NET.
export async function checkin(config: InternalAxiosRequestConfig): Promise<AgendamentoItemApiDto> {
  const match = config.url?.match(/\/agendamentos\/(\d+)\/checkin$/);
  const idAgendamento = match ? Number(match[1]) : 0;
  const body = (typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})) as {
    nrVersion?: number;
  };

  const store = getStore();
  const item = store.find((a) => a.idAgendamento === idAgendamento);
  if (!item) {
    return Promise.reject({
      status: 404,
      code: 'NOT_FOUND',
      message: `Agendamento ${idAgendamento} não encontrado`,
    });
  }

  // Idempotente (REC-11): 2º check-in devolve o estado atual sem checar
  // versão nem sobrescrever o horário.
  if (item.dtCheckin) {
    return { ...item };
  }

  if (item.dsEtapaRecepcao !== 'AGENDADO' && item.dsEtapaRecepcao !== 'CONFIRMADO') {
    return Promise.reject({
      status: 422,
      code: 'ETAPA_NAO_ELEGIVEL',
      message: `Agendamento ${idAgendamento} não permite check-in no estado atual.`,
    });
  }

  if (typeof body.nrVersion === 'number' && body.nrVersion !== item.nrVersion) {
    return Promise.reject({
      status: 409,
      code: 'CONFLITO_CONCORRENCIA',
      message: `Agendamento ${idAgendamento} foi atualizado por outro processo. Releia antes de tentar de novo.`,
    });
  }

  item.dtCheckin = naiveLocal(new Date());
  item.dsEtapaRecepcao = 'CHEGOU';
  item.nrVersion = item.nrVersion + 1;

  return { ...item };
}

// REC-13 — início de atendimento (chamado ao montar a tela de prontuário).
// Mesmo padrão de `checkin` acima: mesma tabela de status elegíveis
// (AGENDADO/CONFIRMADO — AgendaService.cs::StatusElegiveisParaEventoRecepcao,
// compartilhada pelos dois endpoints reais), idempotente por presença de
// `dtInicioAtendimento` (2ª chamada devolve o estado atual sem checar versão
// nem sobrescrever o horário — AgendaService.cs:472-473), e NUNCA toca
// `dtCheckin` (walk-in sem check-in prévio continua sem check-in —
// AgendaService.cs:484). Etapa resultante é `EM_ATENDIMENTO`, espelhando
// `CalcularEtapaRecepcao` (AgendaService.cs:584: `dtInicioAtendimento.HasValue
// -> "EM_ATENDIMENTO"`), não `etapaMockParaStatus()` (que só deriva de
// `dsStatus`, que este endpoint nunca muda).
export async function iniciarAtendimento(
  config: InternalAxiosRequestConfig,
): Promise<AgendamentoItemApiDto> {
  const match = config.url?.match(/\/agendamentos\/(\d+)\/inicio-atendimento$/);
  const idAgendamento = match ? Number(match[1]) : 0;
  const body = (typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})) as {
    nrVersion?: number;
  };

  const store = getStore();
  const item = store.find((a) => a.idAgendamento === idAgendamento);
  if (!item) {
    return Promise.reject({
      status: 404,
      code: 'NOT_FOUND',
      message: `Agendamento ${idAgendamento} não encontrado`,
    });
  }

  // Idempotente (REC-11): 2ª chamada devolve o estado atual sem checar
  // versão nem sobrescrever o horário.
  if (item.dtInicioAtendimento) {
    return { ...item };
  }

  if (item.dsEtapaRecepcao !== 'AGENDADO' && item.dsEtapaRecepcao !== 'CONFIRMADO') {
    return Promise.reject({
      status: 422,
      code: 'ETAPA_NAO_ELEGIVEL',
      message: `Agendamento ${idAgendamento} não permite iniciar atendimento no estado atual.`,
    });
  }

  if (typeof body.nrVersion === 'number' && body.nrVersion !== item.nrVersion) {
    return Promise.reject({
      status: 409,
      code: 'CONFLITO_CONCORRENCIA',
      message: `Agendamento ${idAgendamento} foi atualizado por outro processo. Releia antes de tentar de novo.`,
    });
  }

  item.dtInicioAtendimento = naiveLocal(new Date());
  item.dsEtapaRecepcao = 'EM_ATENDIMENTO';
  item.nrVersion = item.nrVersion + 1;

  return { ...item };
}

// REC-14 — sentinela de teste: `idPet` que existe (`buscarPetArmazenadoPorId` acha),
// mas que este mock simula como NÃO vinculado ao `idTutor` enviado — mesmo padrão de
// `tutores.mock.ts::CPF_MOCK_DUPLICADO` (magic value dedicado a exercitar um ramo de
// erro específico sem precisar montar um estado de store inteiro pra isso).
export const ID_PET_MOCK_NAO_VINCULADO_AO_TUTOR = 88888;

// Mesma regra de `AgendamentoCreateValidator.MaxObservacoesBytes` (Oracle
// VARCHAR2 BYTE, não CHAR) — contagem manual de bytes UTF-8 em vez de
// `TextEncoder` (nem sempre polyfillado no runtime de teste) ou
// `unescape(encodeURIComponent())` (depreciado).
function contarBytesUtf8(texto: string): number {
  let bytes = 0;
  for (const char of texto) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

let _proximoIdAgendamentoCriado = 9000;

// REC-14 — POST /api/v1/agendamentos. Espelha `AgendamentoCreateValidator.cs` (forma) e
// `AgendaService.CriarAsync` (regras relacionais + tolerância de encaixe) — ver o PIN de
// contrato cross-repo em `agenda.service.ts::criarAgendamento`.
//
// 🟡 G2/M-1 — CORREÇÃO: este comentário afirmava que a ordem abaixo (tutor -> pet ->
// vínculo -> veterinário -> triagem de origem -> tolerância de horário -> forma
// tipo/duração/observações/fuso) "replica a ordem real do service". Isso é verdade
// SOBRE O SERVICE, mas FALSO sobre o ENDPOINT: `Program.cs:61` liga
// `AddFluentValidationAutoValidation()`, que roda `AgendamentoCreateValidator` como
// filtro de model-validation ANTES da action — no servidor real, TODO 400 de forma
// precede QUALQUER 404/422 relacional. Este mock põe os 400 por ÚLTIMO. Não corrigido
// nesta fix wave (nenhum teste depende da ordem hoje — a UI nunca envia um payload que
// falhe nos dois ao mesmo tempo, já que `dsTipo` vem de lista fechada de chips e
// `dtAgendamento` é sempre gerado por `formatDateTimeLocalSemFuso`) — só o texto que
// mentia foi corrigido. Se algum dia um teste depender da ordem, reordenar de verdade
// (mover o bloco de forma para o topo) é o fix certo, não outro comentário.
export async function criarAgendamento(
  config: InternalAxiosRequestConfig,
): Promise<AgendamentoItemApiDto> {
  const body = (
    typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})
  ) as AgendamentoCreateWireDto;

  const tutor = buscarTutorArmazenadoPorId(body.idTutor);
  if (!tutor) {
    return Promise.reject({
      status: 404,
      code: 'NOT_FOUND',
      message: `Tutor ${body.idTutor} não encontrado`,
    });
  }

  const pet = buscarPetArmazenadoPorId(body.idPet);
  if (!pet) {
    return Promise.reject({
      status: 404,
      code: 'NOT_FOUND',
      message: `Pet ${body.idPet} não encontrado`,
    });
  }

  const petVinculado =
    body.idPet !== ID_PET_MOCK_NAO_VINCULADO_AO_TUTOR &&
    pet.tutores.some((t) => t.idTutor === body.idTutor);
  if (!petVinculado) {
    return Promise.reject({
      status: 422,
      code: 'REGRA_DE_NEGOCIO',
      message: `Pet ${body.idPet} não está vinculado ao tutor ${body.idTutor}.`,
    });
  }

  const veterinario = buscarVeterinarioArmazenadoPorId(body.idVeterinario);
  if (!veterinario) {
    return Promise.reject({
      status: 404,
      code: 'NOT_FOUND',
      message: `Veterinario ${body.idVeterinario} não encontrado`,
    });
  }

  let dsNivelUrgenciaOrigem: string | null = null;
  if (typeof body.idTriagemOrigem === 'number') {
    const triagem = buscarTriagemMockPorId(body.idTriagemOrigem);
    if (!triagem) {
      return Promise.reject({
        status: 404,
        code: 'NOT_FOUND',
        message: `TriagemLuna ${body.idTriagemOrigem} não encontrada`,
      });
    }
    if (triagem.idTutor !== body.idTutor) {
      return Promise.reject({
        status: 422,
        code: 'REGRA_DE_NEGOCIO',
        message: `Triagem ${body.idTriagemOrigem} não pertence ao tutor ${body.idTutor}.`,
      });
    }
    dsNivelUrgenciaOrigem = triagem.urgencia;
  }

  // G2/A-3 — `AgendamentoCreateValidator.cs` recusa com 400 EXPLÍCITO qualquer
  // `DtAgendamento` cujo `Kind` não seja `Unspecified` (o comentário do validator real
  // cita exatamente `Date.toISOString()` do RN como o cliente mais provável de errar
  // isso). Este mock não tinha NENHUMA checagem equivalente — `new Date(...)` aceita
  // "Z"/offset silenciosamente, então um regresso que trocasse
  // `formatDateTimeLocalSemFuso` por `toISOString()` na tela passaria 100% verde em
  // modo mock enquanto o `.NET` real devolveria 400 em TODO agendamento. Mesma forma
  // de detecção usada pelo validator (ausência de sufixo de fuso), sem reimplementar
  // `DateTimeKind` (que não existe em JS): checagem textual no CORPO CRU, antes de
  // `new Date(...)` normalizar a diferença.
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(body.dtAgendamento)) {
    return Promise.reject({
      status: 400,
      code: 'VALIDACAO',
      message:
        "'DtAgendamento' deve ser enviado como hora local de São Paulo, sem fuso " +
        "(sem 'Z' e sem offset, ex.: '2026-10-07T09:00:00') — 'Z'/offset indicam " +
        'que o cliente está mandando UTC ou outro fuso, o que grava a hora errada.',
    });
  }

  const agora = new Date();
  const dtAgendamento = new Date(body.dtAgendamento);
  if (dtAgendamento.getTime() < agora.getTime() - 15 * 60 * 1000) {
    return Promise.reject({
      status: 422,
      code: 'REGRA_DE_NEGOCIO',
      message: "'DtAgendamento' não pode ser mais de 15 minutos no passado (tolerância de encaixe).",
    });
  }

  if (!TIPOS_AGENDAMENTO_PERMITIDOS.includes(body.dsTipo as (typeof TIPOS_AGENDAMENTO_PERMITIDOS)[number])) {
    return Promise.reject({
      status: 400,
      code: 'VALIDACAO',
      message: `'DsTipo' deve ser um de: ${TIPOS_AGENDAMENTO_PERMITIDOS.join(', ')}.`,
    });
  }

  if (typeof body.duracao === 'number' && (body.duracao < 5 || body.duracao > 480)) {
    return Promise.reject({
      status: 400,
      code: 'VALIDACAO',
      message: "'Duracao' deve estar entre 5 e 480 minutos.",
    });
  }

  if (body.dsObservacoes && contarBytesUtf8(body.dsObservacoes) > AGENDAMENTO_OBSERVACOES_MAX_BYTES) {
    return Promise.reject({
      status: 400,
      code: 'VALIDACAO',
      message: `'DsObservacoes' deve ter no máximo ${AGENDAMENTO_OBSERVACOES_MAX_BYTES} bytes UTF-8.`,
    });
  }

  const idAgendamento = _proximoIdAgendamentoCriado++;
  const novo: AgendamentoItemApiDto = {
    idAgendamento,
    dtAgendamento: body.dtAgendamento,
    duracaoMinutos: body.duracao ?? 30,
    nmTutor: tutor.nmTutor,
    nmPet: pet.nmPet,
    idVeterinario: veterinario.id,
    nmVeterinario: veterinario.nmVeterinario,
    dsTipoConsulta: body.dsTipo,
    dsStatus: 'AGENDADO',
    nrVersion: 0,
    idPet: pet.id,
    idTutor: tutor.id,
    dtCheckin: null,
    dtInicioAtendimento: null,
    // A-1: SEMPRE explícito, mesma regra do backend real — presença de
    // `idTriagemOrigem` é o que decide a origem, nunca o inverso.
    dsOrigem: typeof body.idTriagemOrigem === 'number' ? 'TRIAGEM_LUNA' : 'RECEPCAO',
    dsNivelUrgenciaOrigem,
    dsRespostaConfirmacao: null,
    dsEtapaRecepcao: 'AGENDADO',
    dsFotoThumbUrl: pet.dsFotoThumbUrl ?? null,
  };

  getStore().push(novo);
  return novo;
}
