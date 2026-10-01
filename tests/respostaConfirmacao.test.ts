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

describe('podeOferecerRemarcar (REC-17)', () => {
  it.each(['AGENDADO', 'CONFIRMADO'])('REMARCAR + status %s => oferece', (status) => {
    expect(podeOferecerRemarcar('REMARCAR', status)).toBe(true);
  });

  it.each(['CANCELADO', 'REALIZADO', 'NAO_COMPARECEU', 'EM_ATENDIMENTO'])(
    'REMARCAR + status %s => não oferece (REMARCAR não muda status, o pedido fica gravado depois que a linha andou)',
    (status) => {
      expect(podeOferecerRemarcar('REMARCAR', status)).toBe(false);
    },
  );

  it('SIM nunca oferece, mesmo em status remarcável', () => {
    expect(podeOferecerRemarcar('SIM', 'AGENDADO')).toBe(false);
  });
});
