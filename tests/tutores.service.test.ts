import { telefoneDisponivel, TELEFONE_SENTINELA } from '../src/services/tutores.service';

// LU-09 fix wave 1 (item 2, lu-09-revisao.md G2-3): TutorService.cs:97-99/129-131
// (backend-clinica-dotnet) grava o literal "Não informado" em NR_TELEFONE quando o
// cadastro do tutor não tem telefone — confirmado na fonte (`grep -rn "Não informado"
// src` → 2 ocorrências). `telefoneDisponivel` é o único ponto de decisão sobre oferecer
// ou não a ação "Responder no WhatsApp" da Fila da Luna.
describe('telefoneDisponivel — LU-09 fix wave 1 (item 2, G2-3)', () => {
  it('recusa o sentinela literal do backend', () => {
    expect(telefoneDisponivel('Não informado')).toBe(false);
    expect(telefoneDisponivel(TELEFONE_SENTINELA)).toBe(false);
  });

  it('recusa vazio, só espaço, null e undefined', () => {
    expect(telefoneDisponivel('')).toBe(false);
    expect(telefoneDisponivel('   ')).toBe(false);
    expect(telefoneDisponivel(null)).toBe(false);
    expect(telefoneDisponivel(undefined)).toBe(false);
  });

  it('CONTROLE POSITIVO — telefone real é aceito', () => {
    expect(telefoneDisponivel('11988887777')).toBe(true);
  });
});
