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

// ---------------------------------------------------------------------------------------------------------------
// Análise de condições (BR-CLI-DET, fix wave da G2: I1-I5, M1, M4). Tudo textual, sem AST.
//
// MODELO: cada condição (`if (...)`, teste de ternário, cadeia `{... && <El/>}`) vira uma forma normal disjuntiva
// (DNF) de folhas. Cada disjunto carrega 3 marcas: `err` (lê o erro, positivo), `naoErro` (lê `!erro`) e `guarda`
// (testa a AUSÊNCIA do dado: `!d`, `d == null`, `d === undefined`, `!d?.length`, `d?.length === 0`).
// O erro vence o dado salvo se algum disjunto tem `err` e NÃO tem `guarda` nem `naoErro`. Por isso `isError && data == null`
// passa e `!data || isError` reprova (o 2º disjunto é só `isError`): a guarda de dado só vale em CONJUNÇÃO com o erro.

/** `t` dividido em `sep` ('||' ou '&&') só no nível 0 de (), [] e {}. */
function dividir(t, sep) {
  const partes = [];
  let prof = 0;
  let ini = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '(' || c === '[' || c === '{') prof++;
    else if (c === ')' || c === ']' || c === '}') prof--;
    else if (prof === 0 && t.startsWith(sep, i)) {
      partes.push(t.slice(ini, i));
      i += sep.length - 1;
      ini = i + 1;
    }
  }
  partes.push(t.slice(ini));
  return partes;
}

/** `(x)` -> `x` quando o `(` inicial fecha no último caractere; senão devolve igual. */
function desembrulhar(s) {
  const t = s.trim();
  if (!t.startsWith('(') || !t.endsWith(')')) return t;
  let prof = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '(') prof++;
    else if (t[i] === ')') {
      prof--;
      if (prof === 0 && i < t.length - 1) return t;
    }
  }
  return desembrulhar(t.slice(1, -1));
}

const DADO_ARRAY = String.raw`[\w$]+(?:\[[^\]]*\])?\s*\??\.\s*data(?!\w)`;
const dadoPorNome = (n) => String.raw`(?<![\w.])${esc(n)}(?!\w)`;
const dadoPorObjeto = (q) => String.raw`(?<![\w.])${esc(q)}\s*\??\.\s*data(?!\w)`;

/** Formas que testam a AUSÊNCIA do dado (`dsrc` = regex do dado). `d != null` NÃO é ausência. */
const guardasDe = (dsrc) => [
  new RegExp(String.raw`!\s*\(?\s*${dsrc}(?:\s*\??\.\s*length)?(?![\w.?])`),
  new RegExp(String.raw`${dsrc}\s*===?\s*(?:null|undefined)(?!\w)`),
  new RegExp(String.raw`${dsrc}\s*\??\.\s*length\s*(?:===?\s*0|<\s*1)(?!\w)`),
  new RegExp(String.raw`typeof\s+${dsrc}\s*===?\s*['"]undefined['"]`),
];

const predAlias = (n) => {
  const re = new RegExp(String.raw`(?<![\w.])${esc(n)}(?!\w)`);
  return (s) => re.test(s);
};
/** Leituras de erro de uma query-objeto `q` (M1): isError, error, isRefetchError, status === 'error', com `?.`. */
function predsObjeto(q) {
  const a = new RegExp(String.raw`(?<![\w.])${esc(q)}\s*\??\.\s*(?:isError|error|isRefetchError)(?!\w)`);
  const b = new RegExp(String.raw`(?<![\w.])${esc(q)}\s*\??\.\s*status\s*===?\s*['"]error['"]`);
  return [(s) => a.test(s), (s) => b.test(s)];
}
/** Leitura do erro de CADA item de um `useQueries` (`rs.some(r => r.isError)`, `rs[0]?.isError`) dentro de `s`. */
function leuErroDoArray(s, nome) {
  const re = new RegExp(String.raw`(?<![\w.])${esc(nome)}(?!\w)\s*(?:\.\s*\w+\s*\(|\[)`, 'g');
  for (const m of s.matchAll(re)) {
    const depois = m.index + m[0].length;
    const leu = m[0].endsWith('(') ? /\bisError\b/.test(argsBalanceados(s, depois)) : /^[^\]]*\]\s*\??\.isError\b/.test(s.slice(depois));
    if (leu) return true;
  }
  return false;
}

function novoCtx(erros, dadosSrc, rotulo) {
  return { erros, dadosSrc, rotulo };
}
const temGuarda = (ctx, s) => ctx.dadosSrc.some((d) => guardasDe(d).some((re) => re.test(s)));
const lerErro = (ctx, s) => ctx.erros.some((p) => p(s));

function folha(s, ctx) {
  const neg = /^!(?!=)/.test(s);
  const resto = neg ? desembrulhar(s.slice(1)) : s;
  const le = lerErro(ctx, resto);
  return { err: !neg && le, naoErro: neg && le, guarda: temGuarda(ctx, s) };
}

function dnf(t, ctx) {
  const ors = dividir(t, '||');
  if (ors.length > 1) return ors.flatMap((p) => dnf(p, ctx));
  const ands = dividir(t, '&&');
  if (ands.length > 1) {
    return ands
      .map((p) => dnf(p, ctx))
      .reduce(
        (acc, d) => acc.flatMap((a) => d.map((b) => ({ err: a.err || b.err, naoErro: a.naoErro || b.naoErro, guarda: a.guarda || b.guarda }))),
        [{ err: false, naoErro: false, guarda: false }],
      );
  }
  const s = t.trim();
  const inner = desembrulhar(s);
  if (inner !== s) return dnf(inner, ctx);
  return [folha(s, ctx)];
}
const erroSemGuarda = (d) => d.some((x) => x.err && !x.naoErro && !x.guarda);

/** Início do teste de um ternário cujo `?` está em `q`: anda para trás até um delimitador de nível 0. */
function inicioDoTeste(t, q) {
  let prof = 0;
  for (let i = q - 1; i >= 0; i--) {
    const c = t[i];
    if (c === ')' || c === ']' || c === '}') prof++;
    else if (c === '(' || c === '[' || c === '{') {
      if (prof === 0) return i + 1;
      prof--;
    } else if (prof === 0) {
      if (c === ';' || c === ',' || c === ':') return i + 1;
      if (c === '?' && !'.?'.includes(t[i + 1] ?? ' ') && t[i - 1] !== '?') return i + 1;
      if (c === '=') {
        if (t[i + 1] === '>') return i + 2;
        if (!/[=!<>]/.test(t[i - 1] ?? '') && t[i + 1] !== '=') return i + 1;
      }
      if (i >= 5 && t.slice(i - 5, i + 1) === 'return' && !/[\w$]/.test(t[i - 6] ?? '')) return i + 1;
    }
  }
  return 0;
}

const ateFecharChave = (t, i) => {
  let p = 0;
  for (let j = i; j < t.length; j++) {
    if (t[j] === '{') p++;
    else if (t[j] === '}') {
      if (p === 0) return t.slice(i, j);
      p--;
    }
  }
  return t.slice(i);
};

/** Sítios de condição do componente: `if (...)`, teste de ternário e cadeia `{... && <El/>}`. */
function condicoes(util) {
  const out = [];
  for (const m of util.matchAll(/\bif\s*\(/g)) out.push({ tipo: 'if', texto: argsBalanceados(util, m.index + m[0].length) });
  for (let i = 0; i < util.length; i++) {
    if (util[i] !== '?' || '.?:'.includes(util[i + 1] ?? ' ') || util[i - 1] === '?') continue;
    const faixa = /^\s*\(?\s*<\s*FaixaDadosSalvos\b/.test(util.slice(i + 1));
    out.push({ tipo: 'ternario', texto: util.slice(inicioDoTeste(util, i), i), faixa });
  }
  for (const m of util.matchAll(/\{\s*([^{}]*?)\s*&&\s*\(?\s*</g)) {
    out.push({ tipo: 'jsx', texto: m[1], depois: ateFecharChave(util, m.index + m[0].length) });
  }
  return out;
}

/**
 * Segue variáveis locais que guardam o erro ou o dado: `const erro = q.isError;`, `const mostrar = isError && !isFetching;`,
 * `const sala = mutation.data ?? q.data;` (G2-I3). O alias de erro herda a regra da definição: se a própria definição já tem
 * `&& <dado> == null`, o alias é seguro e não entra. Objeto literal e arrow function não são aliases.
 */
function seguirAliases(util, ctx, naQueryState) {
  const vistos = new Set();
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const m of util.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*([^;]+?)\s*;/g)) {
      const nome = m[1];
      const rhs = m[2];
      if (vistos.has(nome) || /^\s*\{/.test(rhs) || /^\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>/.test(rhs) || naQueryState(nome)) continue;
      if (erroSemGuarda(dnf(rhs, ctx))) {
        ctx.erros.push(predAlias(nome));
        vistos.add(nome);
        mudou = true;
      } else if (!lerErro(ctx, rhs) && ctx.dadosSrc.some((d) => new RegExp(d).test(rhs))) {
        ctx.dadosSrc.push(dadoPorNome(nome));
        vistos.add(nome);
        mudou = true;
      }
    }
  }
}

/**
 * "erro vence o dado salvo" (BR-CLI-G4 achado 3; F3-I1 a/b; G2-I1/I2/I3/I5). Com dado em cache e refetch falho `isError` e
 * `data` valem juntos: a tela que entrega o erro sem exigir a AUSÊNCIA do dado descarta o dado salvo.
 */
function erroAntesDoDado(util, ctx) {
  if (!ctx.dadosSrc.length) return null;
  const dado = ctx.rotulo;
  for (const c of condicoes(util)) {
    const d = dnf(c.texto, ctx);
    const cond = c.texto.trim().replace(/\s+/g, ' ');
    if (c.tipo === 'jsx') {
      // `{!erro && <Lista d={dado}/>}`: a lista some quando o erro chega (o dado salvo é escondido).
      if (d.length && d.every((x) => x.naoErro) && ctx.dadosSrc.some((s) => new RegExp(s).test(c.depois))) {
        return `{${cond} && <...${dado}...>}: o erro negado esconde o dado salvo (isError antes de data)`;
      }
      continue;
    }
    if (erroSemGuarda(d) && !(c.tipo === 'ternario' && c.faixa)) {
      if (c.tipo === 'if') {
        if (cond.includes('||')) return `if (${cond}): o erro vence o dado salvo dentro de \`||\` (isError antes de data); a guarda de ${dado} só vale em \`&&\` com o erro`;
        if (cond.includes('&&')) return `if (${cond}): condição composta sem guarda de ${dado}, retorno antecipado descarta o dado salvo (isError antes de data)`;
        return `if (${cond}) sem guarda de ${dado}: retorno antecipado descarta o dado salvo (isError antes de data)`;
      }
      return `${cond} ? ... sem guarda de ${dado}: o erro vence o dado salvo (isError antes de data)`;
    }
    // `!erro ? <Lista/> : <Erro/>` e `!erro && dado ? ... : <Erro/>` são o mesmo ternário com os ramos trocados.
    if (c.tipo === 'ternario' && !c.faixa && d.length && d.every((x) => x.naoErro && !x.err)) {
      return `${cond} ? ...: erro negado, o ramo de erro vence o dado salvo (isError antes de data)`;
    }
  }
  return null;
}

/**
 * Review Focus §5: a frase de erro e a frase de vazio nunca podem coincidir. O componente renderiza o erro por uma cadeia
 * `{erro && <...` SEM guarda de dado E um vazio `{<x>.length === 0 && <...` sem o erro na cadeia. (G2-M4: erro só COM guarda de dado
 * — `if (isError && data == null) return <ErrorState/>` — não coincide com o vazio, que só existe com dado.)
 */
function erroEVazio(util, ctx) {
  const cs = condicoes(util).filter((c) => c.tipo === 'jsx');
  if (!cs.some((c) => erroSemGuarda(dnf(c.texto, ctx)))) return null;
  for (const c of cs) {
    if (!/\.length\s*===?\s*0|!\s*[\w.?]+\.length\b|\.length\s*<\s*1/.test(c.texto)) continue;
    const d = dnf(c.texto, ctx);
    if (d.length && d.every((x) => x.err || x.naoErro)) continue; // o erro está na cadeia do vazio (`!erro`, ou o próprio erro)
    return `erro e vazio podem coincidir: o componente renderiza o erro e também \`${c.texto.trim().replace(/\s+/g, ' ')} && <...>\` sem \`!erro\` (Review Focus §5)`;
  }
  return null;
}

const problemaDeErro = (util, ctx, naQueryState) => {
  seguirAliases(util, ctx, naQueryState);
  return erroAntesDoDado(util, ctx) ?? erroEVazio(util, ctx);
};

/**
 * BR-TUT-T03 (F3-I1 d): `useQueries` devolve um ARRAY. A palavra `isError` em qualquer lugar do componente não basta.
 * Exige o erro de CADA item lido pelo próprio array: `res.some/every/find/filter/map(... isError ...)` ou `res[i].isError`; se o
 * resultado da leitura for guardado numa variável, ela tem de ser usada (`void x` não conta). E (G2-I4) o erro lido não pode
 * vencer o dado: `if (rs.some(r => r.isError)) return <Erro/>` descarta a lista salva de todos os itens. O caminho aceito é
 * agregar o erro num objeto entregue a `<QueryState query={...}>`, ou guardar com `&& <item>.data == null`.
 */
function avaliarUseQueries(util, lhs, naQueryState) {
  const nome = /^(\w+)$/.exec(lhs)?.[1];
  if (!nome) return { ok: false, motivo: 'useQueries: o resultado precisa ficar numa variável simples (para checar isError de cada item)' };
  const re = new RegExp(String.raw`(?<![\w.])${nome}(?!\w)\s*(?:\.\s*\w+\s*\(|\[)`, 'g');
  let leuAlgum = false;
  for (const m of util.matchAll(re)) {
    const depois = m.index + m[0].length;
    let leu;
    if (m[0].endsWith('(')) leu = /\bisError\b/.test(argsBalanceados(util, depois));
    else leu = /^[^\]]*\]\s*\??\.isError\b/.test(util.slice(depois));
    if (!leu) continue;
    const guardado = /(?:const|let)\s+(\w+)\s*=\s*$/.exec(util.slice(0, m.index));
    if (guardado && contar(util.replace(new RegExp(String.raw`\bvoid\s+${guardado[1]}\b`, 'g'), ' '), guardado[1]) < 2) continue;
    leuAlgum = true;
    break;
  }
  if (!leuAlgum) return { ok: false, motivo: `useQueries: o isError de cada item de ${nome} não é lido (ex.: ${nome}.some(r => r.isError)) ou é lido e descartado` };
  const ctx = novoCtx([(s) => leuErroDoArray(s, nome)], [DADO_ARRAY], 'o data do item');
  const problema = problemaDeErro(util, ctx, naQueryState);
  return problema ? { ok: false, motivo: `useQueries: ${problema}` } : { ok: true };
}

/** Forma OBJETO (`const q = useX()`, ou `const { query: q } = useX()`): as regras valem iguais (G2-I5), com ou sem <QueryState>. */
function avaliarObjeto(util, nome, naQueryState, semLeitura) {
  const ctx = novoCtx(predsObjeto(nome), [dadoPorObjeto(nome)], `${nome}.data`);
  // Desestruturação em 2ª instrução a partir do objeto (`const { isError: falhou, data: d } = q;`): os aliases entram na análise.
  for (const d of util.matchAll(new RegExp(String.raw`\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*${esc(nome)}\s*[;\n]`, 'g'))) {
    const aliasErro = /\bisError\s*(?::\s*(\w+))?/.exec(d[1]);
    if (!aliasErro) continue;
    ctx.erros.push(predAlias(aliasErro[1] ?? 'isError'));
    const aliasDado = /\bdata\s*(?::\s*(\w+))?/.exec(d[1]);
    if (aliasDado) ctx.dadosSrc.push(dadoPorNome(aliasDado[1] ?? 'data'));
  }
  const leu = ctx.erros.some((p) => p(util));
  if (leu) {
    const problema = problemaDeErro(util, ctx, naQueryState);
    if (problema) return { ok: false, motivo: problema };
    if (predsObjeto(nome).some((p) => p(util))) return { ok: true };
  }
  if (naQueryState(nome)) return { ok: true };
  return { ok: false, motivo: semLeitura };
}

/** `escopo` = texto do componente (declaração de topo) que contém a chamada. */
function avaliarChamada(t, escopo, hook, idx) {
  const lhs = lhsDaChamada(t, idx);
  if (lhs === null) return { ok: false, motivo: 'resultado da query descartado ou não atribuído' };
  const util = semUsoInocuo(escopo);
  const naQueryState = (q) => new RegExp(String.raw`<QueryState\b(?:[^<>]|=>)*?\bquery=\{\s*${esc(q)}\s*\}`).test(util);
  if (hook === 'useQueries') {
    return avaliarUseQueries(util, lhs, naQueryState);
  }
  if (lhs.startsWith('{')) {
    const alias = /\bisError\s*(?::\s*(\w+))?/.exec(lhs);
    const q = /\bquery\s*:\s*(\w+)/.exec(lhs);
    if (alias) {
      const nome = alias[1] ?? 'isError';
      if (contar(util, nome) >= 2) {
        const dataMatch = /\bdata\s*(?::\s*(\w+))?/.exec(lhs);
        const ctx = novoCtx([predAlias(nome)], dataMatch ? [dadoPorNome(dataMatch[1] ?? 'data')] : [], dataMatch?.[1] ?? 'data');
        const problema = problemaDeErro(util, ctx, naQueryState);
        return problema ? { ok: false, motivo: problema } : { ok: true };
      }
      return { ok: false, motivo: `isError lido (${nome}) mas nunca usado no componente` };
    }
    if (q) return avaliarObjeto(util, q[1], naQueryState, 'destructuring sem isError');
    return { ok: false, motivo: 'destructuring sem isError' };
  }
  const nome = /^(\w+)/.exec(lhs)?.[1];
  if (!nome) return { ok: false, motivo: 'atribuição não reconhecida' };
  return avaliarObjeto(util, nome, naQueryState, `${nome} nunca passa a <QueryState query> nem lê .isError`);
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
