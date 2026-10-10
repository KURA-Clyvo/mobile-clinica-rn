#!/usr/bin/env node
// BR-CLI-T03 — gate 2: arquivo que lê dado de servidor sem tratar o ERRO mente (erro vira "vazio").
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
// LIMITES DECLARADOS (M-1 da revisão G2): a checagem de "uso" é textual, não é análise de fluxo.
// Descontamos `console.*(...)` e `if (x) {}` vazio, mas `isError ? null : x` ou `if (isError) foo()`
// contam como uso mesmo que o ramo de erro seja inócuo; `query={q}` só vale colado a `<QueryState`;
// `q` repassado por prop a um filho é violação (conservador). `useSuspenseQuery` lança o erro a um
// error boundary, que este script não enxerga: exige allowlist com a razão. Hook que não começa
// por `use`, ou chamado por alias importado (`import { useX as useY }`), não é descoberto.
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

/** `escopo` = texto do componente (declaração de topo) que contém a chamada. */
function avaliarChamada(t, escopo, hook, idx) {
  const lhs = lhsDaChamada(t, idx);
  if (lhs === null) return { ok: false, motivo: 'resultado da query descartado ou não atribuído' };
  const util = semUsoInocuo(escopo);
  const naQueryState = (q) => new RegExp(String.raw`<QueryState\b(?:[^<>]|=>)*?\bquery=\{\s*${esc(q)}\s*\}`).test(util);
  if (hook === 'useQueries') {
    // resultado é um ARRAY de queries: exige algum isError lido no mesmo componente.
    return /\bisError\b/.test(util) ? { ok: true } : { ok: false, motivo: 'useQueries sem leitura de isError' };
  }
  if (lhs.startsWith('{')) {
    const alias = /\bisError\s*(?::\s*(\w+))?/.exec(lhs);
    const q = /\bquery\s*:\s*(\w+)/.exec(lhs);
    if (alias) {
      const nome = alias[1] ?? 'isError';
      if (contar(util, nome) >= 2) return { ok: true };
      return { ok: false, motivo: `isError lido (${nome}) mas nunca usado no componente` };
    }
    if (q && (contar(util, `${q[1]}.isError`) > 0 || naQueryState(q[1]))) return { ok: true };
    return { ok: false, motivo: 'destructuring sem isError' };
  }
  const nome = /^(\w+)/.exec(lhs)?.[1];
  if (!nome) return { ok: false, motivo: 'atribuição não reconhecida' };
  if (new RegExp(String.raw`\b${nome}\.isError\b`).test(util) || naQueryState(nome)) return { ok: true };
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
