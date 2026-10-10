import { voltarOu, fichaDoPet, destinoSemHistorico } from '../src/utils/navegacao';

const mk = (canGoBack: boolean) => ({ back: jest.fn(), canGoBack: () => canGoBack, replace: jest.fn() });

describe('voltarOu', () => {
  it('com histórico: back(), sem replace', () => {
    const r = mk(true);
    voltarOu(r, '/pacientes');
    expect(r.back).toHaveBeenCalledTimes(1);
    expect(r.replace).not.toHaveBeenCalled();
  });
  it('sem histórico: replace(destino), sem back()', () => {
    const r = mk(false);
    voltarOu(r, '/pacientes');
    expect(r.replace).toHaveBeenCalledWith('/pacientes');
    expect(r.back).not.toHaveBeenCalled();
  });
});

describe('destinos-pai', () => {
  it('fichaDoPet: id válido → ficha; inválido/ausente → Hoje', () => {
    expect(fichaDoPet('7')).toBe('/pacientes/7');
    expect(fichaDoPet(7)).toBe('/pacientes/7');
    expect(fichaDoPet(undefined)).toBe('/dashboard');
    expect(fichaDoPet('abc')).toBe('/dashboard');
  });
  it('ficha → lista de pacientes', () => {
    expect(destinoSemHistorico('ficha')).toBe('/pacientes');
  });
});
