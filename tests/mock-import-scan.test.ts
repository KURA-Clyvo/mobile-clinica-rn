// LU-10 (KURA_BACKLOG_LUNA_AI) — teste de varredura derivado do código (regra de
// ouro v7), espelhando `tests/smoke-coverage.test.ts` (TASK-81) e
// `tests/touch-target-coverage.test.ts` (CQ-08): a lista de "quem importa
// mocks/" vem de `discoverMockImporters` (AST via `typescript`), não de um
// inventário escrito à mão que apodreceria em silêncio.
//
// MORDIDA (achado N4 do backlog, brief LU-10): rodado contra o código de
// `origin/main` @ b134731, este teste falha apontando
// `components/domain/LunaSuggestionBadge.tsx` — ele importava `sugestaoSOAP`
// direto de `mocks/luna.mock.ts`, contornando o `mock-adapter.ts` (o único
// portão controlado por `EXPO_PUBLIC_USE_MOCKS`). Saída literal capturada
// ANTES da correção, reproduzida no relatório desta task
// (dev VsClaude/.superpowers/sdd/KURA_BACKLOG_LUNA_AI/lu-10-report.md).
import * as path from 'path';
import { discoverMockImporters, ehImportadorLegitimo } from '../src/mockImportScan/discoverMockImports';

const SRC_DIR = path.join(__dirname, '..', 'src');

describe('mock-import-scan — nenhum arquivo fora de src/mocks/ e mock-adapter.ts importa de mocks/ (LU-10)', () => {
  const importadores = discoverMockImporters(SRC_DIR);

  // Controle positivo: prova que a varredura ENXERGA um import de mocks/ de
  // verdade, antes de confiar num "0 violadores" que poderia ser um glob
  // quebrado silenciosamente. mock-adapter.ts é o portão legítimo — ele TEM
  // que aparecer aqui, com os 9 fixtures que hoje agrega (agenda, auth,
  // cobrancas, dashboard, eventos-clinicos, financeiro, luna, pets,
  // servicos-preco, teleconsulta, usuarios-clinica, veterinarios — >=9 na
  // medição desta task).
  it('controle positivo: a varredura encontra o mock-adapter.ts importando de mocks/ (o portão legítimo)', () => {
    const adapter = importadores.find((i) => i.file === 'services/api/mock-adapter.ts');
    expect(adapter).toBeDefined();
    expect(adapter!.specifiers.length).toBeGreaterThanOrEqual(9);
  });

  // O mecanismo central do detector: todo importador de mocks/ que NÃO é
  // src/mocks/** nem o mock-adapter.ts é um violador. `LunaSuggestionBadge.tsx`
  // era o único antes da correção desta task — ver mordida no cabeçalho.
  it('nenhum arquivo fora da exceção declarada importa de mocks/ — mordida: LunaSuggestionBadge.tsx antes da correção', () => {
    const violadores = importadores.filter((i) => !ehImportadorLegitimo(i.file));
    expect(violadores.map((v) => v.file)).toEqual([]);
  });

  // Resumo sempre visível — mesma disciplina dos 2 detectores irmãos.
  it('imprime o inventário completo de importadores de mocks/ (visível, não silencioso)', () => {
    // eslint-disable-next-line no-console
    console.log(
      `[mock-import-scan] ${importadores.length} arquivo(s) importam de mocks/: ` +
        importadores.map((i) => `${i.file} (${i.specifiers.length})`).join(', '),
    );
    expect(importadores.length).toBeGreaterThan(0);
  });
});
