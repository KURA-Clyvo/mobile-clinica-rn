#!/usr/bin/env node
// BR-CLI-T03 — gate 2: tela que lê dado de servidor sem tratar o ERRO mente (erro vira "vazio").
//
// Regra v7: NADA é lista escrita à mão. As telas vêm de `src/app/**` e os hooks de dado vêm de
// `src/hooks/**` (função exportada cujo corpo chama `useQuery(`, direto ou via outro hook de
// dado já descoberto). Para CADA chamada de hook de dado numa tela, o resultado precisa:
//   (a) ser passado inteiro a `<QueryState query={...}>`, ou
//   (b) ter `isError` lido (destructuring ou `.isError`) E esse nome ser USADO de novo no arquivo.
// Do contrário a chamada é violação, salvo entrada em ALLOWLIST (razão > 30 caracteres).
//
// Uso:  node scripts/check-query-state.mjs [--root <dir>] [--json]   (exit 1 com violação)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Chave: "<arquivo relativo a src/app>::<hook>". Razão precisa explicar por que erro não importa.
export const ALLOWLIST = {
  '(app)/teleorientacao/[idPet].tsx::usePetDetail':
    'pet rende só o subtítulo opcional "pet · tutor" sobre o vídeo; se a query falha o subtítulo some e a tela não afirma nada sobre o paciente',
  '(app)/usuarios/index.tsx::useVeterinariosParaSelecao':
    'lookup auxiliar só do nome da ficha vinculada no cartão do usuário; se falha, o nome é omitido e a lista de usuários (QueryState) segue honesta',
};

const RAZAO_MIN = 30;

function listar(dir, ext, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listar(p, ext, acc);
    else if (ext.test(e.name) && !/\.test\./.test(e.name)) acc.push(p);
  }
  return acc;
}

const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Hooks de dado: derivados de src/hooks. Fecha transitivamente (hook que chama hook de dado). */
export function descobrirHooksDeDado(root) {
  const arquivos = listar(path.join(root, 'src', 'hooks'), /\.(ts|tsx)$/);
  const corpos = new Map(); // nome -> corpo
  for (const f of arquivos) {
    const t = semComentarios(fs.readFileSync(f, 'utf8'));
    const re = /export\s+(?:function|const)\s+(use\w+)/g;
    const marcas = [...t.matchAll(re)];
    marcas.forEach((m, i) => {
      corpos.set(m[1], t.slice(m.index, i + 1 < marcas.length ? marcas[i + 1].index : t.length));
    });
  }
  const dados = new Set();
  for (const [n, c] of corpos) if (/\buseQuery\s*[<(]/.test(c)) dados.add(n);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const [n, c] of corpos) {
      if (dados.has(n)) continue;
      for (const d of dados) {
        if (new RegExp(String.raw`\b${d}\s*\(`).test(c)) {
          dados.add(n);
          mudou = true;
          break;
        }
      }
    }
  }
  return [...dados].sort();
}

const contar = (t, nome) => (t.match(new RegExp(String.raw`(?<![\w.])${nome}(?!\w)`, 'g')) ?? []).length;

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

function avaliarChamada(t, hook, idx) {
  const lhs = lhsDaChamada(t, idx);
  if (lhs === null) return { ok: false, motivo: 'resultado da query descartado ou não atribuído' };
  if (lhs.startsWith('{')) {
    // destructuring: procura isError (com ou sem alias) e `query: nome`
    const alias = /\bisError\s*(?::\s*(\w+))?/.exec(lhs);
    const q = /\bquery\s*:\s*(\w+)/.exec(lhs);
    if (alias) {
      const nome = alias[1] ?? 'isError';
      // declarado + pelo menos 1 uso a mais no arquivo
      if (contar(t, nome) >= 2) return { ok: true };
      return { ok: false, motivo: `isError lido (${nome}) mas nunca usado` };
    }
    if (q && (contar(t, `${q[1]}.isError`) > 0 || new RegExp(String.raw`query=\{\s*${q[1]}\s*\}`).test(t))) return { ok: true };
    return { ok: false, motivo: 'destructuring sem isError' };
  }
  const nome = /^(\w+)/.exec(lhs)?.[1];
  if (!nome) return { ok: false, motivo: 'atribuição não reconhecida' };
  if (new RegExp(String.raw`\b${nome}\.isError\b`).test(t) || new RegExp(String.raw`query=\{\s*${nome}\s*\}`).test(t)) return { ok: true };
  return { ok: false, motivo: `${nome} nunca passa a <QueryState query> nem lê .isError` };
}

export function analisar(root) {
  const hooks = descobrirHooksDeDado(root);
  const appDir = path.join(root, 'src', 'app');
  const telas = listar(appDir, /\.tsx$/).map((f) => path.relative(appDir, f).split(path.sep).join('/'));
  const chamadas = [];
  const violacoes = [];
  for (const rel of telas) {
    const t = semComentarios(fs.readFileSync(path.join(appDir, rel), 'utf8'));
    const re = new RegExp(String.raw`\b(${hooks.join('|')})\s*\(`, 'g');
    if (hooks.length === 0) break;
    for (const m of t.matchAll(re)) {
      if (/function\s+$/.test(t.slice(Math.max(0, m.index - 12), m.index))) continue;
      const linha = t.slice(0, m.index).split('\n').length;
      const r = avaliarChamada(t, m[1], m.index);
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
  return { telas, hooks, chamadas, violacoes };
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
    console.log(`telas: ${r.telas.length} | hooks de dado: ${r.hooks.length} | chamadas: ${r.chamadas.length}`);
    for (const v of r.violacoes) console.log(`VIOLACAO ${v.tela}:${v.linha} ${v.hook} — ${v.motivo}`);
    console.log(`violacoes: ${r.violacoes.length}`);
  }
  process.exit(r.violacoes.length ? 1 : 0);
}
