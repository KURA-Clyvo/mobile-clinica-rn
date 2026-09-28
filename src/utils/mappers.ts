import type {
  PetResponse,
  PetTutorVinculo,
  AlertaResponse,
  TimelineEventResponse,
  AgendamentoResponse,
  MedicamentoResponse,
  VeterinarioResponse,
  DashboardHojeResponse,
} from '../types/api';
import type {
  Pet,
  Tutor,
  Alerta,
  EventoTimeline,
  Agendamento,
  Medicamento,
  Veterinario,
  DashboardHoje,
} from '../types/domain';
import type { PetPalette } from '../components/primitives/KCPetPortrait';

export function racaToPalette(raca: string): PetPalette {
  const r = raca.toLowerCase();
  if (r.includes('labrador')) return 'lab';
  if (r.includes('siam')) return 'siam';
  if (r.includes('border')) return 'border';
  if (r.includes('poodle')) return 'poodle';
  if (r.includes('persa')) return 'persa';
  if (r.includes('golden')) return 'golden';
  if (r.includes('husky')) return 'husky';
  return 'srd';
}

// REC-04 fix wave (G2, I-3): `mapTutorDto`/`mapPetDto` não têm NENHUM
// consumidor real (confirmado por grep — só a própria definição e o teste
// dedicado, `tests/mappers.test.ts`; nenhuma tela/hook os chama). O
// parâmetro segue `PetTutorVinculo` (o shape REAL de `PetResponse.tutores`,
// `types/api.ts`) — telefone/e-mail não vêm mais desse endpoint, então
// `Tutor.telefone`/`Tutor.email` (types/domain.ts, também sem consumidor
// real) ficam vazios aqui em vez de inventar um dado que o backend não
// fornece.
export function mapTutorDto(dto: PetTutorVinculo): Tutor {
  return {
    id: dto.idTutor,
    nome: dto.nmTutor,
    telefone: '',
    email: '',
  };
}

export function mapPetDto(dto: PetResponse): Pet {
  return {
    id: dto.id,
    nome: dto.nmPet,
    especie: dto.nmEspecie,
    raca: dto.nmRaca,
    dataNascimento: new Date(dto.dtNascimento),
    sexo: dto.sgSexo,
    porte: dto.sgPorte,
    tutores: dto.tutores.map(mapTutorDto),
    // FT-08: repassa as URLs de foto sem transformação (null/undefined
    // significam "sem foto" — a UI trata os 2 casos da mesma forma).
    fotoUrl: dto.dsFotoUrl,
    fotoThumbUrl: dto.dsFotoThumbUrl,
  };
}

export function mapAlertaDto(dto: AlertaResponse): Alerta {
  return {
    id: dto.id,
    tipo: dto.dsTipoAlerta,
    mensagem: dto.dsMensagem,
    idPet: dto.idPet ?? undefined,
    nomePet: dto.nmPet ?? undefined,
    criadoEm: new Date(dto.dtCriacao),
  };
}

export function mapEventoTimelineDto(dto: TimelineEventResponse): EventoTimeline {
  return {
    id: dto.idEventoClinico,
    tipo: dto.nmTipo,
    data: new Date(dto.dtEvento),
    observacao: dto.dsObservacao,
    nomeVeterinario: dto.nmVeterinario ?? undefined,
  };
}

export function mapAgendamentoDto(dto: AgendamentoResponse): Agendamento {
  return {
    id: dto.id,
    inicio: new Date(dto.dtInicio),
    duracaoMinutos: dto.nrDuracaoMinutos,
    status: dto.sgStatus,
    pet: {
      id: dto.pet.id,
      nome: dto.pet.nmPet,
      especie: dto.pet.nmEspecie,
      raca: dto.pet.nmRaca,
    },
    tutor: {
      id: dto.tutor.id,
      nome: dto.tutor.nmTutor,
      telefone: dto.tutor.dsTelefone,
    },
    veterinario: {
      id: dto.veterinario.id,
      nome: dto.veterinario.nmVeterinario,
      crmv: dto.veterinario.nrCRMV,
    },
    observacao: dto.dsObservacao ?? undefined,
  };
}

export function mapMedicamentoDto(dto: MedicamentoResponse): Medicamento {
  return {
    id: dto.id,
    nome: dto.nmMedicamento,
    principioAtivo: dto.dsPrincipioAtivo,
    concentracao: dto.dsConcentracao,
    apresentacao: dto.dsApresentacao,
  };
}

export function mapVeterinarioDto(dto: VeterinarioResponse): Veterinario {
  return {
    id: dto.id,
    nome: dto.nmVeterinario,
    crmv: dto.nrCRMV,
    email: dto.dsEmail,
    telefone: dto.dsTelefone ?? undefined,
    fotoUrl: dto.dsFotoUrl ?? undefined,
    especialidade: dto.dsEspecialidade ?? undefined,
    bio: dto.dsBio ?? undefined,
  };
}

export function mapDashboardHojeDto(dto: DashboardHojeResponse): DashboardHoje {
  return {
    consultasHoje: dto.metrics.nrConsultasHoje,
    pacientesAtendidos: dto.metrics.nrPacientesAtendidos,
    alertasAtivos: dto.metrics.nrAlertasAtivos,
    teleorientacoes: dto.metrics.nrTeleorientacoes,
    resumo: dto.dailySummary.dsResumo,
    ultimaAtualizacao: new Date(dto.dailySummary.dtUltimaAtualizacao),
  };
}
