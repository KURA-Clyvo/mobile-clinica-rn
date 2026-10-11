// BR-CLI-T09 (BR-CLI-13): os rotulos de status/etapa de agendamento e de nivel de urgencia moram
// numa TABELA so, `STRINGS.rotulos` (src/constants/strings.ts). Agendamento no feminino
// ("Agendada", "Concluída"), nivel "Alta/Média/Baixa". Este gate falha se um desses rotulos
// reaparecer como literal fora da tabela (aspas ou texto de JSX) em qualquer arquivo de src/.
// Fora do alcance, de proposito: strings.ts (a tabela), src/mocks (dado de teste).
import fs from 'fs';
import path from 'path';
import { STRINGS } from '../src/constants/strings';

const SRC = path.join(__dirname, '..', 'src');
const ASPAS = /(['"`])(?:Agendad[oa]|Confirmad[oa]|Conclu[ií]d[oa]|Finalizad[oa]|Cancelad[oa]|Alt[ao]|M[ée]dia|Baixa|Baixo)\1/;
const JSX = />\s*(?:Agendad[oa]|Confirmad[oa]|Conclu[ií]d[oa]|Finalizad[oa]|Cancelad[oa]|Alt[ao]|M[ée]dia|Baixa|Baixo)\s*</;

const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const achados = (t: string) =>
  semComentarios(t)
    .split(String.fromCharCode(10))
    .filter((l) => ASPAS.test(l) || JSX.test(l));

const arquivos = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'mocks' ? [] : arquivos(p);
    return /\.tsx?$/.test(e.name) && e.name !== 'strings.ts' ? [p] : [];
  });

describe('gate: vocabulario unico de status e urgencia', () => {
  it('o detector pega as iscas (controle positivo)', () => {
    expect(achados("const a = 'Agendado';")).toHaveLength(1);
    expect(achados('<Text>Concluída</Text>')).toHaveLength(1);
    expect(achados('return "Alta";')).toHaveLength(1);
    expect(achados('const a = STRINGS.rotulos.urgencia.ALTA;')).toHaveLength(0);
    expect(achados("// 'Agendado' e comentario")).toHaveLength(0);
  });

  it('a tabela tem os rotulos no feminino e Alta/Média/Baixa', () => {
    expect(STRINGS.rotulos.etapa.AGENDADO).toBe(STRINGS.rotulos.status.AGENDADA);
    expect(STRINGS.rotulos.etapa.FINALIZADO).toBe(STRINGS.rotulos.status.CONCLUIDA);
    expect(STRINGS.rotulos.etapa.CANCELADO).toBe(STRINGS.rotulos.status.CANCELADA);
    expect(Object.values(STRINGS.rotulos.urgencia)).toEqual(['Alta', 'Média', 'Baixa']);
  });

  it('varre uma quantidade real de arquivos (controle)', () => {
    expect(arquivos(SRC).length).toBeGreaterThan(100);
  });

  it('0 rotulo literal fora da tabela', () => {
    const sujos = arquivos(SRC)
      .map((f) => [path.relative(SRC, f), achados(fs.readFileSync(f, 'utf8'))] as const)
      .filter(([, a]) => a.length > 0);
    expect(sujos).toEqual([]);
  });
});
