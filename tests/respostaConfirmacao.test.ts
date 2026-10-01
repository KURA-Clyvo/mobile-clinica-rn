import { seloRespostaTutor, podeOferecerRemarcar } from '../src/utils/respostaConfirmacao';

// REC-17 — valor de `dsRespostaConfirmacao` => selo. Domínio fechado no servidor
// em SIM|CANCELAR|REMARCAR (RespostaConfirmacaoRequestValidator.cs:23 @ 81d5a58).
describe('seloRespostaTutor (REC-17)', () => {
  it('SIM => "Confirmou pelo WhatsApp", sem ação de remarcar', () => {
    expect(seloRespostaTutor('SIM')).toEqual({
      label: 'Confirmou pelo WhatsApp',
      tone: 'sage',
      oferecerRemarcar: false,
    });
  });

  it('REMARCAR => "Pediu para remarcar", com ação de remarcar', () => {
    expect(seloRespostaTutor('REMARCAR')).toEqual({
      label: 'Pediu para remarcar',
      tone: 'amber',
      oferecerRemarcar: true,
    });
  });

  it.each([null, undefined, '', 'CANCELAR', 'sim', 'remarcar', 'XPTO'])(
    'valor %p => sem selo (CANCELAR já aparece como status Cancelado; desconhecido não inventa selo)',
    (valor) => {
      expect(seloRespostaTutor(valor as string | null | undefined)).toBeNull();
    },
  );
});

// O 2º parâmetro é a ETAPA (dsEtapaRecepcao), não o ST_STATUS: o servidor não muda o
// status no check-in/início (AgendaService.cs:140-145 @ 81d5a58).
describe('podeOferecerRemarcar (REC-17)', () => {
  it.each(['AGENDADO', 'CONFIRMADO'])('REMARCAR + etapa %s => oferece', (etapa) => {
    expect(podeOferecerRemarcar('REMARCAR', etapa)).toBe(true);
  });

  it.each(['CHEGOU', 'EM_ATENDIMENTO', 'FINALIZADO', 'NAO_COMPARECEU', 'CANCELADO'])(
    'REMARCAR + etapa %s => não oferece (o pedido fica gravado depois que a linha andou)',
    (etapa) => {
      expect(podeOferecerRemarcar('REMARCAR', etapa)).toBe(false);
    },
  );

  it('SIM nunca oferece, mesmo em etapa remarcável', () => {
    expect(podeOferecerRemarcar('SIM', 'AGENDADO')).toBe(false);
  });
});
