import {
  mapPetDto,
  mapAlertaDto,
  mapEventoTimelineDto,
  mapAgendamentoDto,
  mapMedicamentoDto,
} from '../src/utils/mappers';
import type {
  PetResponse,
  AlertaResponse,
  TimelineEventResponse,
  AgendamentoResponse,
  MedicamentoResponse,
} from '../src/types/api';

const petFixture: PetResponse = {
  id: 1,
  nmPet: 'Thor',
  nmEspecie: 'Cão',
  nmRaca: 'Labrador',
  dtNascimento: '2020-03-15T00:00:00.000Z',
  sgSexo: 'M',
  sgPorte: 'G',
  tutores: [{ id: 10, nmTutor: 'Carlos Mendes', dsTelefone: '11999990001', dsEmail: 'carlos@email.com' }],
};

const alertaFixture: AlertaResponse = {
  id: 5,
  dsTipoAlerta: 'VACINA_VENCIDA',
  dsMensagem: 'Vacina antirrábica vencida',
  idPet: 1,
  nmPet: 'Thor',
  dtCriacao: '2026-05-01T10:00:00.000Z',
};

const alertaSemPetFixture: AlertaResponse = {
  id: 6,
  dsTipoAlerta: 'IOT_TEMPERATURA',
  dsMensagem: 'Temperatura fora do padrão',
  dtCriacao: '2026-05-01T11:00:00.000Z',
};

const timelineFixture: TimelineEventResponse = {
  idEventoClinico: 100,
  nmTipo: 'CONSULTA',
  dtEvento: '2026-04-20T14:00:00.000Z',
  dsObservacao: 'Consulta de rotina',
  nmVeterinario: 'Dr. Felipe Ferrete',
};

const timelineSemVetFixture: TimelineEventResponse = {
  idEventoClinico: 101,
  nmTipo: 'VACINA',
  dtEvento: '2026-04-10T09:00:00.000Z',
  dsObservacao: 'V10 aplicada',
};

const agendamentoFixture: AgendamentoResponse = {
  id: 200,
  dtInicio: '2026-05-06T09:00:00.000Z',
  nrDuracaoMinutos: 30,
  sgStatus: 'AGENDADA',
  pet: { id: 1, nmPet: 'Thor', nmEspecie: 'Cão', nmRaca: 'Labrador' },
  tutor: { id: 10, nmTutor: 'Carlos Mendes', dsTelefone: '11999990001' },
  veterinario: { id: 20, nmVeterinario: 'Dr. Felipe Ferrete', nrCRMV: 'SP-12345' },
};

const medicamentoFixture: MedicamentoResponse = {
  id: 300,
  nmMedicamento: 'Amoxicilina',
  dsPrincipioAtivo: 'Amoxicilina triidratada',
  dsConcentracao: '500mg',
  dsApresentacao: 'Comprimidos',
};

describe('mappers', () => {
  describe('mapPetDto', () => {
    it('maps all fields correctly', () => {
      const pet = mapPetDto(petFixture);
      expect(pet.id).toBe(1);
      expect(pet.nome).toBe('Thor');
      expect(pet.especie).toBe('Cão');
      expect(pet.raca).toBe('Labrador');
      expect(pet.sexo).toBe('M');
      expect(pet.porte).toBe('G');
      expect(pet.tutores).toHaveLength(1);
      expect(pet.tutores[0]?.nome).toBe('Carlos Mendes');
    });

    it('maps dataNascimento as Date instance', () => {
      const pet = mapPetDto(petFixture);
      expect(pet.dataNascimento).toBeInstanceOf(Date);
      expect(pet.dataNascimento.getFullYear()).toBe(2020);
    });

    it('handles pet with empty tutores array', () => {
      const dto: PetResponse = { ...petFixture, tutores: [] };
      const pet = mapPetDto(dto);
      expect(pet.tutores).toEqual([]);
    });
  });

  describe('mapAlertaDto', () => {
    it('maps all fields correctly', () => {
      const alerta = mapAlertaDto(alertaFixture);
      expect(alerta.id).toBe(5);
      expect(alerta.tipo).toBe('VACINA_VENCIDA');
      expect(alerta.mensagem).toBe('Vacina antirrábica vencida');
      expect(alerta.idPet).toBe(1);
      expect(alerta.nomePet).toBe('Thor');
    });

    it('criadoEm is a Date instance', () => {
      const alerta = mapAlertaDto(alertaFixture);
      expect(alerta.criadoEm).toBeInstanceOf(Date);
    });

    it('maps optional idPet as undefined when absent', () => {
      const alerta = mapAlertaDto(alertaSemPetFixture);
      expect(alerta.idPet).toBeUndefined();
      expect(alerta.nomePet).toBeUndefined();
    });
  });

  describe('mapEventoTimelineDto', () => {
    it('maps all fields correctly', () => {
      const evento = mapEventoTimelineDto(timelineFixture);
      expect(evento.id).toBe(100);
      expect(evento.tipo).toBe('CONSULTA');
      expect(evento.observacao).toBe('Consulta de rotina');
      expect(evento.nomeVeterinario).toBe('Dr. Felipe Ferrete');
    });

    it('data is a Date instance', () => {
      const evento = mapEventoTimelineDto(timelineFixture);
      expect(evento.data).toBeInstanceOf(Date);
    });

    it('nomeVeterinario is undefined when absent', () => {
      const evento = mapEventoTimelineDto(timelineSemVetFixture);
      expect(evento.nomeVeterinario).toBeUndefined();
    });
  });

  describe('mapAgendamentoDto', () => {
    it('maps all fields correctly', () => {
      const ag = mapAgendamentoDto(agendamentoFixture);
      expect(ag.id).toBe(200);
      expect(ag.status).toBe('AGENDADA');
      expect(ag.duracaoMinutos).toBe(30);
      expect(ag.pet.nome).toBe('Thor');
      expect(ag.tutor.nome).toBe('Carlos Mendes');
      expect(ag.veterinario.crmv).toBe('SP-12345');
    });

    it('inicio is a Date instance', () => {
      const ag = mapAgendamentoDto(agendamentoFixture);
      expect(ag.inicio).toBeInstanceOf(Date);
    });

    it('observacao is undefined when absent', () => {
      const ag = mapAgendamentoDto(agendamentoFixture);
      expect(ag.observacao).toBeUndefined();
    });
  });

  describe('mapMedicamentoDto', () => {
    it('maps all fields correctly', () => {
      const med = mapMedicamentoDto(medicamentoFixture);
      expect(med.id).toBe(300);
      expect(med.nome).toBe('Amoxicilina');
      expect(med.principioAtivo).toBe('Amoxicilina triidratada');
      expect(med.concentracao).toBe('500mg');
      expect(med.apresentacao).toBe('Comprimidos');
    });
  });
});
