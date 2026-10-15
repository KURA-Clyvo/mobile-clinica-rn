// BR-CLI-T09 (BR-CLI-13): os rotulos de status/etapa de agendamento e de nivel de urgencia moram
// numa TABELA so, `STRINGS.rotulos` (src/constants/strings.ts). Agendamento no feminino
// ("Agendada", "Concluída"), nivel "Alta/Média/Baixa". Este gate falha se um desses rotulos
// reaparecer como literal fora da tabela (aspas ou texto de JSX) em qualquer arquivo de src/.
// Fora do alcance, de proposito: strings.ts (a tabela), src/mocks (dado de teste).
import fs from 'fs';
import path from 'path';
import { STRINGS } from '../src/constants/strings';

const SRC = path.join(__dirname, '..', 'src');
// I3 (fix wave G2): varre o CONTEUDO do arquivo (nao linha a linha). O termo proibido, como palavra
// inteira, nao pode aparecer (a) dentro de literal de string/template -- com ou sem prefixo
// ("Status: Finalizado") -- nem (b) como texto de JSX, inclusive quebrado em varias linhas.
const TERMO = String.raw`(?<!\p{L})(?:Agendad[oa]|Confirmad[oa]|Conclu[ií]d[oa]|Finalizad[oa]|Cancelad[oa]|Alt[ao]|M[ée]dia|Baixa|Baixo)(?!\p{L})`;
const TEM_TERMO = new RegExp(TERMO, 'u');
// literais de string de uma linha ('..' ou "..") e templates (`..`, podem quebrar linha)
const LITERAIS = /'(?:[^'\n\\]|\\.)*'|"(?:[^"\n\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
// texto de JSX entre `>`/`}` e `<`/`{`, inclusive em varias linhas (pega o trecho apos uma interpolacao)
const TEXTO_JSX = /[>}][^<>{}]+(?=[<{])/g;

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
// devolve os trechos que violam (vazio = limpo)
const achados = (t: string): string[] => {
  const src = semComentarios(t);
  return [...(src.match(LITERAIS) ?? []), ...(src.match(TEXTO_JSX) ?? [])]
    .filter((x) => TEM_TERMO.test(x))
    .map((x) => x.replace(/\s+/g, ' ').trim().slice(0, 80));
};

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
    // sondas da G2: texto JSX em linha propria, com prefixo, template literal
    expect(achados(['<Text style={s}>', '  Finalizado', '</Text>'].join(String.fromCharCode(10)))).toHaveLength(1);
    expect(achados("const a = 'Status: Finalizado';")).toHaveLength(1);
    expect(achados('const a = `${n} Finalizado`;')).toHaveLength(1);
    expect(achados("const a = 'Altamente';")).toHaveLength(0);
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
