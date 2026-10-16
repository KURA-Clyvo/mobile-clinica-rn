#!/usr/bin/env node
// ÂNCORA (regra 11): a lógica de análise abaixo é cópia de mobile-tutor-rn `scripts/check-query-state.mjs`, linhas 81-375
// (de `const RAZAO_MIN = 30` ao fim), commit 6fb15d5 (main do tutor, com as regras da fix wave da BR-TUT-T03: F3-I1 a-f),
// conferida em 2026-10-16 (BR-CLI-DET):
//   git -C D:/FIAP/KURA/mobile-tutor-rn show 6fb15d5:scripts/check-query-state.mjs | sed -n '81,375p'
// Reproduz a igualdade (saída vazia = trecho idêntico; o trecho inicia na linha `const RAZAO_MIN = 30` deste arquivo):
//   diff <(git -C D:/FIAP/KURA/mobile-tutor-rn show 6fb15d5:scripts/check-query-state.mjs | sed -n '81,375p') <(sed -n '/^const RAZAO_MIN = 30/,$p' scripts/check-query-state.mjs)
// O bloco de regras/limites do cabeçalho (tutor 12-50) também é cópia (tutor 6fb15d5), exceto a linha-título.
// DIVERGÊNCIAS clínica x tutor: (1) este cabeçalho de âncora e a linha-título (BR-CLI-DET, origem BR-CLI-T03);
// (2) a ALLOWLIST é própria da clínica (1 entrada permanente, razão abaixo; o tutor tem 8 entradas de migração T04/T07);
// (3) caminhos de tela `app/(app)/...` na clínica, `app/(tabs)/...` no tutor. Não há divergência de lógica.
// Roda por `node` puro: no Windows o `npm run` usa cmd.exe e isto não tem sintaxe POSIX.
// BR-CLI-DET (origem BR-CLI-T03, regras novas portadas do tutor): arquivo que lê dado de servidor sem tratar o ERRO mente (erro vira "vazio").
//
// Regra v7: NADA é lista escrita à mão. Tudo é derivado de `src/**` (.ts e .tsx, sem testes):
//   * HOOK DE DADO = qualquer função `use*` (declaração, `export default`, `const useX = ...`,
//     `export { useX }`, definida em src/hooks, src/services, src/components, src/app ou no próprio
//     arquivo) cujo corpo chama `useQuery|useInfiniteQuery|useQueries|useSuspenseQuery`, direto ou
//     via outro hook de dado já descoberto (fecho transitivo).
//   * CONSUMIDOR = qualquer arquivo de src (telas, componentes, contextos...). Cada chamada de hook
//     de dado, ou de um dos 4 primitivos do React Query escrito direto no arquivo, precisa:
//       (a) passar o resultado inteiro a `<QueryState query={...}>`, ou
//       (b) ler `isError` (destructuring ou `.isError`) E usá-lo de novo DENTRO DO MESMO COMPONENTE
//           (a declaração de topo que contém a chamada) numa expressão que afeta o render.
//     Chamada dentro do corpo de um hook de dado não conta (o resultado é devolvido ao chamador,
//     que é checado no lugar dele).
//   Do contrário é violação, salvo entrada em ALLOWLIST (razão > 30 caracteres).
//
// REGRAS DE "erro antes do dado" / vazio / useQueries (BR-CLI-G4 + F3-I1 da G2 da BR-TUT-T03). O detector REPROVA:
//   * desestruturação OU objeto (`const q = useX()`, lendo `q.isError`) em que o erro vence o dado salvo: `isError || !data`,
//     `if (isError) ...`, `if (isError && <cond sem o dado>)` (ex.: `isError && !isFetching`), `isError ? <X/> : ...`;
//     a forma objeto vale mesmo quando a query TAMBÉM vai para <QueryState> (retorno antecipado por fora do kit descarta o dado);
//     vale também para a desestruturação em 2ª instrução a partir do objeto, com ou sem renomeação
//     (`const { isError: falhou } = q; if (falhou) ...`; reprodução do maestro, sessão 6);
//   * componente que renderiza o erro (`{isError && <...`, ou `<ErrorState` direto) E um vazio `{x.length === 0 && <...`
//     sem `!isError` na cadeia (as duas frases coincidiriam; Review Focus §5);
//   * `useQueries` cujo array não tem o isError de CADA item lido pelo próprio array (`res.some/every/find/map(... isError ...)`,
//     `res[i].isError`) ou em que o valor lido é guardado e jogado fora (`void x`); `isError` solto no componente não basta.
// LIMITES DECLARADOS (M-1 da revisão G2): a checagem de "uso" é textual, não é análise de fluxo.
// Descontamos `console.*(...)` e `if (x) {}` vazio, mas `isError ? null : x` ou `if (isError) foo()`
// contam como uso mesmo que o ramo de erro seja inócuo; `query={q}` só vale colado a `<QueryState`;
// `q` repassado por prop a um filho é violação (conservador). `useSuspenseQuery` lança o erro a um
// error boundary, que este script não enxerga: exige allowlist com a razão. Hook que não começa
// por `use`, ou chamado por ALIAS importado (`import { useX as useY }`), não é descoberto (limite declarado, F3-I1 e: não resolvemos
// alias de import). Também NÃO pega: ternário encadeado/retorno antecipado para a regra do vazio (só a forma `&&`); a condição
// do `if` lida só até o 1º `)` (parênteses aninhados cortam); o dado lido por variável derivada (`const l = q.data ?? []` e
// `if (q.isError && l.length === 0)`) conta como "sem guarda de q.data" (conservador: o caminho aceito é <QueryState>);
// `useQueries` com o resultado desestruturado (`const [a, b] = useQueries(...)`) ou sem variável simples é violação; o detector
// não prova que o erro lido chega ao render, só que ele é lido e usado.
//
// Uso:  node scripts/check-query-state.mjs [--root <dir>] [--json]   (exit 1 com violação)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Chave: "<arquivo relativo a src>::<hook>". Razão precisa explicar por que erro não importa.
export const ALLOWLIST = {
  'app/(app)/teleorientacao/[idPet].tsx::usePetDetail':
    'pet rende só o subtítulo opcional "pet · tutor" sobre o vídeo; se a query falha o subtítulo some e a tela não afirma nada sobre o paciente',
};

const RAZAO_MIN = 30;
const PRIMITIVOS = ['useQuery', 'useInfiniteQuery', 'useQueries', 'useSuspenseQuery'];
const RE_PRIMITIVO = new RegExp(String.raw`\b(?:${PRIMITIVOS.join('|')})\s*[<(]`);

function listar(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listar(p, acc);
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name) && !/\.d\.ts$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Declarações de topo (coluna 0): início de cada função/const. O fim é o início da próxima. */
function declaracoes(t) {
  const re = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s*(\w*)|(?:const|let)\s+(\w+))/gm;
  const marcas = [...t.matchAll(re)];
  return marcas.map((m, i) => ({
    nome: m[1] || m[2] || '',
    ini: m.index,
    fim: i + 1 < marcas.length ? marcas[i + 1].index : t.length,
  }));
}

function lerArquivos(root) {
  const src = path.join(root, 'src');
  return listar(src).map((f) => {
    const t = semComentarios(fs.readFileSync(f, 'utf8'));
    return { rel: path.relative(src, f).split(path.sep).join('/'), t, decl: declaracoes(t) };
  });
}

/** Hooks de dado: derivados de src/**. Fecha transitivamente (hook que chama hook de dado). */
function descobrir(arquivos) {
  const corpos = new Map(); // nome -> [corpo...]
  const aliases = []; // export { a as b }
  for (const a of arquivos) {
    for (const d of a.decl) {
      if (!/^use[A-Z]\w*$/.test(d.nome)) continue;
      if (!corpos.has(d.nome)) corpos.set(d.nome, []);
      corpos.get(d.nome).push(a.t.slice(d.ini, d.fim));
    }
    for (const m of a.t.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const parte of m[1].split(',')) {
        const x = /^\s*(use\w+)\s+as\s+(use\w+)\s*$/.exec(parte);
        if (x) aliases.push([x[1], x[2]]);
      }
    }
  }
  const dados = new Set();
  for (const [n, cs] of corpos) if (cs.some((c) => RE_PRIMITIVO.test(c))) dados.add(n);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const [n, cs] of corpos) {
      if (dados.has(n)) continue;
      for (const d of dados) {
        const re = new RegExp(String.raw`\b${d}\s*[<(]`);
        if (cs.some((c) => re.test(c))) {
          dados.add(n);
          mudou = true;
          break;
        }
      }
    }
    for (const [orig, alias] of aliases) {
      if (dados.has(orig) && !dados.has(alias)) {
        dados.add(alias);
        mudou = true;
      }
    }
  }
  return [...dados].sort();
}

export function descobrirHooksDeDado(root) {
  return descobrir(lerArquivos(root));
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const contar = (t, nome) => (t.match(new RegExp(String.raw`(?<![\w.])${esc(nome)}(?!\w)`, 'g')) ?? []).length;

/** Remove do trecho o que NÃO conta como uso de isError: console.*(...) e `if (...) {}` vazio. */
const semUsoInocuo = (t) =>
  t
    .replace(/console\.\w+\s*\([^;]*\)/g, ' ')
    .replace(/\bif\s*\([^)]*\)\s*\{\s*\}/g, ' ');

/** Lê o que está à esquerda de `= hook(` na MESMA declaração (último const/let, sem `;` no meio). */
function lhsDaChamada(t, idx) {
  const antes = t.slice(0, idx);
  const k = Math.max(antes.lastIndexOf('const '), antes.lastIndexOf('let '));
  if (k < 0) return null;
  const trecho = antes.slice(k).replace(/^(const|let)\s+/, '');
  if (trecho.includes(';')) return null;
  const m = /^([\s\S]*?)=\s*(?:await\s+)?$/.exec(trecho);
  return m ? m[1].trim() : null;
}

/**
 * BR-CLI-G4 (achado 3): "isError antes de data". Com dado em cache e refetch falho `isError` e `data`
 * valem juntos; a tela que testa `isError` primeiro (`isError || !data`, ou `isError ? <Erro/>`)
 * DESCARTA o dado salvo e mostra só o erro. O certo: `isError && data == null ? <Erro/>` e, com dado,
 * o conteúdo + <FaixaDadosSalvos/>. Só vale quando o destructuring traz o `data` (sem ele não há o
 * que descartar). Heurística textual (mesmos limites do restante deste script).
 */
function erroAntesDoDado(util, erro, dataMatch) {
  if (!dataMatch) return null;
  const dado = dataMatch[1] ?? 'data';
  const e = esc(erro);
  const d = esc(dado);
  if (new RegExp(String.raw`(?<![\w.])${e}\s*\|\|\s*(?:!\s*${d}\b|${d}\s*(?:==|!=)=?\s*(?:null|undefined)|!\s*\(?\s*${d}\b)`).test(util)) {
    return `${erro} || <ausência de ${dado}> descarta o dado salvo (isError antes de data)`;
  }
  // `if (erro) return ...` / `if (erro) {`: retorno antecipado sem guarda de dado (reprodução do maestro, BR-CLI-G4).
  if (new RegExp(String.raw`\bif\s*\(\s*${e}\s*\)`).test(util)) {
    return `if (${erro}) sem guarda de ${dado}: retorno antecipado descarta o dado salvo (isError antes de data)`;
  }
  // BR-TUT-T03 (F3-I1 b): `if (erro && !isFetching) return ...` — condição composta que lê o erro e NÃO menciona o dado.
  for (const m of util.matchAll(/\bif\s*\(([^)]*)\)/g)) {
    const cond = m[1];
    if (!new RegExp(String.raw`(?<![\w.!])${e}(?!\w)`).test(cond)) continue;
    if (new RegExp(String.raw`(?<![\w.])${d}(?!\w)`).test(cond)) continue; // há guarda de dado na condição
    return `if (${cond.trim()}): condição composta sem guarda de ${dado}, retorno antecipado descarta o dado salvo (isError antes de data)`;
  }
  // `erro ? <Algo/>` como 1º teste de um ternário, salvo quando o ramo é a faixa de dados salvos.
  for (const m of util.matchAll(new RegExp(String.raw`(?<![\w.!&|])${e}\s*\?\s*(\(?\s*<\s*(\w+))?`, 'g'))) {
    if (m[2] === 'FaixaDadosSalvos') continue;
    return `${erro} ? ... sem guarda de ${dado}: o erro vence o dado salvo (isError antes de data)`;
  }
  return null;
}

/**
 * BR-TUT-T03 (F3-I1 c, Review Focus §5): a frase de erro e a frase de vazio nunca podem coincidir. Regra textual: o componente
 * renderiza o erro (`{erro && <...`, ou `<ErrorState` direto) E renderiza um vazio por `{<x>.length === 0 && <...` em
 * expressão `&&` SEM `!erro` na mesma cadeia. LIMITE: ternário/retorno antecipado não são analisados (o retorno antecipado já é
 * pego por `erroAntesDoDado`; ternário encadeado certo — `erro && data == null ? <E/> : vazio ? <V/> : ...` — passa).
 */
function erroEVazio(util, erro) {
  const e = esc(erro);
  const renderizaErro = new RegExp(String.raw`(?<![\w.!])${e}\s*&&\s*\(?\s*<`).test(util) || /<ErrorState\b/.test(util);
  if (!renderizaErro) return null;
  for (const m of util.matchAll(/\{\s*\(?([^{}]*?(?:\.length\s*===?\s*0|!\s*[\w.?]+\.length\b|\.length\s*<\s*1))\s*\)?\s*&&\s*\(?\s*</g)) {
    if (new RegExp(String.raw`!\s*${e}(?!\w)`).test(m[1])) continue; // `!erro` na cadeia: o vazio só aparece sem erro
    if (new RegExp(String.raw`(?<![\w.!])${e}\s*&&`).test(m[1])) continue; // cadeia do próprio erro (ErrorState só quando vazio)
    return `erro e vazio podem coincidir: o componente renderiza o erro e também \`${m[1].trim()} && <...>\` sem \`!${erro}\` (Review Focus §5)`;
  }
  return null;
}

/** Conteúdo entre parênteses balanceados; `i` aponta para o 1º caractere DEPOIS do `(` de abertura. */
function argsBalanceados(t, i) {
  let prof = 1;
  let j = i;
  for (; j < t.length && prof > 0; j++) {
    if (t[j] === '(') prof++;
    else if (t[j] === ')') prof--;
  }
  return t.slice(i, j - 1);
}

/**
 * BR-TUT-T03 (F3-I1 d): `useQueries` devolve um ARRAY. A palavra `isError` em qualquer lugar do componente não basta (a
 * `petsQuery.isError` da Saúde enganava o detector com o erro das vacinas descartado). Exige o erro de CADA item lido pelo
 * próprio array: `res.some/every/find/filter/map(... isError ...)` ou `res[i].isError`; e, se o resultado da leitura for
 * guardado numa variável, essa variável tem de ser usada (`void x` não conta). LIMITE: não prova que o valor lido chega ao render.
 */
function avaliarUseQueries(util, lhs) {
  const nome = /^(\w+)$/.exec(lhs)?.[1];
  if (!nome) return { ok: false, motivo: 'useQueries: o resultado precisa ficar numa variável simples (para checar isError de cada item)' };
  const re = new RegExp(String.raw`(?<![\w.])${nome}(?!\w)\s*(?:\.\s*\w+\s*\(|\[)`, 'g');
  for (const m of util.matchAll(re)) {
    const depois = m.index + m[0].length;
    let leu;
    if (m[0].endsWith('(')) leu = /\bisError\b/.test(argsBalanceados(util, depois));
    else leu = /^[^\]]*\]\s*\??\.isError\b/.test(util.slice(depois));
    if (!leu) continue;
    const guardado = /(?:const|let)\s+(\w+)\s*=\s*$/.exec(util.slice(0, m.index));
    if (guardado && contar(util.replace(new RegExp(String.raw`\bvoid\s+${guardado[1]}\b`, 'g'), ' '), guardado[1]) < 2) continue;
    return { ok: true };
  }
  return { ok: false, motivo: `useQueries: o isError de cada item de ${nome} não é lido (ex.: ${nome}.some(r => r.isError)) ou é lido e descartado` };
}

/** `escopo` = texto do componente (declaração de topo) que contém a chamada. */
function avaliarChamada(t, escopo, hook, idx) {
  const lhs = lhsDaChamada(t, idx);
  if (lhs === null) return { ok: false, motivo: 'resultado da query descartado ou não atribuído' };
  const util = semUsoInocuo(escopo);
  const naQueryState = (q) => new RegExp(String.raw`<QueryState\b(?:[^<>]|=>)*?\bquery=\{\s*${esc(q)}\s*\}`).test(util);
  if (hook === 'useQueries') {
    return avaliarUseQueries(util, lhs);
  }
  if (lhs.startsWith('{')) {
    const alias = /\bisError\s*(?::\s*(\w+))?/.exec(lhs);
    const q = /\bquery\s*:\s*(\w+)/.exec(lhs);
    if (alias) {
      const nome = alias[1] ?? 'isError';
      if (contar(util, nome) >= 2) {
        const problema = erroAntesDoDado(util, nome, /\bdata\s*(?::\s*(\w+))?/.exec(lhs)) ?? erroEVazio(util, nome);
        return problema ? { ok: false, motivo: problema } : { ok: true };
      }
      return { ok: false, motivo: `isError lido (${nome}) mas nunca usado no componente` };
    }
    if (q && (contar(util, `${q[1]}.isError`) > 0 || naQueryState(q[1]))) return { ok: true };
    return { ok: false, motivo: 'destructuring sem isError' };
  }
  const nome = /^(\w+)/.exec(lhs)?.[1];
  if (!nome) return { ok: false, motivo: 'atribuição não reconhecida' };
  // Reprodução do maestro (BR-TUT-T03, sessão 6): desestruturação em 2ª instrução a partir do objeto
  // (`const { isError: falhou } = q;`) escapava, porque só `q.isError` era procurado e `q` também ia para <QueryState>.
  // Cada `{ ... } = <nome>` que lê isError passa pelas mesmas regras; o dado aceito é o `data` da mesma
  // desestruturação ou `<nome>.data`.
  for (const d of util.matchAll(new RegExp(String.raw`\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*${esc(nome)}\s*[;\n]`, 'g'))) {
    const aliasErro = /\bisError\s*(?::\s*(\w+))?/.exec(d[1]);
    if (!aliasErro) continue;
    const erro = aliasErro[1] ?? 'isError';
    const aliasDado = /\bdata\s*(?::\s*(\w+))?/.exec(d[1]);
    const problema =
      erroAntesDoDado(util, erro, aliasDado ?? [null, `${nome}.data`]) ?? erroEVazio(util, erro);
    if (problema) return { ok: false, motivo: problema };
  }
  if (new RegExp(String.raw`\b${nome}\.isError\b`).test(util)) {
    // forma OBJETO: a regra "erro antes do dado" vale igual (F3-I1 a/b); o dado é `<nome>.data`. Vale também quando a query
    // TAMBÉM vai para <QueryState>: o retorno antecipado por fora do kit descartaria o dado salvo do mesmo jeito.
    const problema = erroAntesDoDado(util, `${nome}.isError`, [null, `${nome}.data`]) ?? erroEVazio(util, `${nome}.isError`);
    return problema ? { ok: false, motivo: problema } : { ok: true };
  }
  if (naQueryState(nome)) return { ok: true };
  return { ok: false, motivo: `${nome} nunca passa a <QueryState query> nem lê .isError` };
}

export function analisar(root) {
  const arquivos = lerArquivos(root);
  const hooks = descobrir(arquivos);
  const nomes = [...new Set([...hooks, ...PRIMITIVOS])];
  const re = new RegExp(String.raw`\b(${nomes.join('|')})\s*[<(]`, 'g');
  const dadosSet = new Set(hooks);
  const chamadas = [];
  const violacoes = [];
  for (const a of arquivos) {
    const { rel, t, decl } = a;
    // spans de definição de hook de dado: o resultado é devolvido ao chamador, que é quem se checa
    const spansHook = decl.filter((d) => dadosSet.has(d.nome));
    for (const m of t.matchAll(re)) {
      if (/function\*?\s+$/.test(t.slice(Math.max(0, m.index - 12), m.index))) continue;
      if (spansHook.some((s) => m.index >= s.ini && m.index < s.fim)) continue;
      const d = decl.find((x) => m.index >= x.ini && m.index < x.fim);
      const escopo = d ? t.slice(d.ini, d.fim) : t;
      const linha = t.slice(0, m.index).split('\n').length;
      const r = avaliarChamada(t, escopo, m[1], m.index);
      const chave = `${rel}::${m[1]}`;
      const razao = ALLOWLIST[chave];
      const item = { tela: rel, hook: m[1], linha, ok: r.ok, motivo: r.motivo, allowlist: razao ? true : false };
      if (razao !== undefined && String(razao).length <= RAZAO_MIN) {
        item.ok = false;
        item.motivo = `allowlist com razão curta (${String(razao).length} <= ${RAZAO_MIN})`;
        item.allowlist = false;
      }
      chamadas.push(item);
      if (!item.ok && !item.allowlist) violacoes.push(item);
    }
  }
  return {
    telas: arquivos.filter((x) => x.rel.startsWith('app/')).map((x) => x.rel),
    arquivos: arquivos.map((x) => x.rel),
    hooks,
    chamadas,
    violacoes,
  };
}

const principal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (principal) {
  const args = process.argv.slice(2);
  if (args.includes('--allowlist')) {
    console.log(JSON.stringify(ALLOWLIST));
    process.exit(0);
  }
  const iRoot = args.indexOf('--root');
  const root = iRoot >= 0 ? path.resolve(args[iRoot + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const r = analisar(root);
  if (args.includes('--json')) {
    console.log(JSON.stringify(r));
  } else {
    console.log(`arquivos: ${r.arquivos.length} | hooks de dado: ${r.hooks.length} | chamadas: ${r.chamadas.length}`);
    for (const v of r.violacoes) console.log(`VIOLACAO ${v.tela}:${v.linha} ${v.hook} — ${v.motivo}`);
    console.log(`violacoes: ${r.violacoes.length}`);
  }
  process.exit(r.violacoes.length ? 1 : 0);
}
