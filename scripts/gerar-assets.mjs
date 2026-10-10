#!/usr/bin/env node
// Gerador dos assets de marca do app da clínica (BR-CLI-T04).
//
// Fonte única da forma: os `d=` dos paths e os círculos do `KuraMark.tsx`
// (lidos do arquivo, não copiados). Fonte única das cores: `src/theme/tokens.ts`
// (`lightColors`/`darkColors`). Rasterização: `sharp` (Apache-2.0, devDependency,
// pinada) — o PNG é consequência reproduzível de código, não binário opaco.
//
// Uso:
//   node scripts/gerar-assets.mjs              grava assets/*.png
//   node scripts/gerar-assets.mjs --verificar  não grava; compara os pixels de
//                                              assets/*.png com o que seria gerado
//                                              (EXIT=1 se divergir). Usado pelo Jest.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = resolve(RAIZ, 'assets');

// ---------- geometria: lida do KuraMark.tsx ----------
function lerGeometria() {
  const src = readFileSync(resolve(RAIZ, 'src/components/brand/KuraMark.tsx'), 'utf8');
  const paths = [...src.matchAll(/<Path\s+d="([^"]+)"/g)].map((m) => m[1]);
  const circulos = [...src.matchAll(/<Circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map((m) => ({
    cx: m[1],
    cy: m[2],
    r: m[3],
  }));
  const vbW = Number(/VIEWBOX_WIDTH = (\d+)/.exec(src)?.[1]);
  const vbH = Number(/VIEWBOX_HEIGHT = (\d+)/.exec(src)?.[1]);
  // 2 paths de corpo (preenchimento e contorno, mesmo d), 1 haste, 3 círculos.
  const corpo = paths.find((d) => d.includes('C'));
  const haste = paths.find((d) => d.includes('L'));
  if (!corpo || !haste || circulos.length !== 3 || !vbW || !vbH) {
    throw new Error('gerar-assets: geometria do KuraMark.tsx não reconhecida — o gerador precisa ser atualizado');
  }
  return { corpo, haste, circulos, vbW, vbH };
}

// ---------- cores: lidas do tokens.ts ----------
function lerTokens() {
  const src = readFileSync(resolve(RAIZ, 'src/theme/tokens.ts'), 'utf8');
  const bloco = (nome) => {
    const ini = src.indexOf(`export const ${nome}`);
    const fim = src.indexOf('\n};', ini);
    const corpo = src.slice(ini, fim);
    return Object.fromEntries([...corpo.matchAll(/^\s+(\w+):\s*'(#[0-9A-Fa-f]{6})'/gm)].map((m) => [m[1], m[2]]));
  };
  const claro = bloco('lightColors');
  const escuro = bloco('darkColors');
  for (const k of ['primary', 'primarySoft', 'primaryPale', 'textOnPrimary', 'bg']) {
    if (!claro[k] || !escuro[k]) throw new Error(`gerar-assets: token ${k} não encontrado em tokens.ts`);
  }
  return { claro, escuro };
}

const G = lerGeometria();
const T = lerTokens();

/** Símbolo completo, com as variantes de cor. `x,y` canto superior esquerdo, `w` largura em px. */
function simbolo({ x, y, w, corpo, hasteCor, hasteOpac, patas, contorno, contornoOpac, corpoOpac = 1, lateraisOpac = 0.85 }) {
  const k = w / G.vbW;
  const [c, l, r] = G.circulos;
  const pata = (ci, cor, op) => `<circle cx="${ci.cx}" cy="${ci.cy}" r="${ci.r}" fill="${cor}" opacity="${op}"/>`;
  return (
    `<g transform="translate(${x} ${y}) scale(${k})">` +
    `<path d="${G.corpo}" fill="${corpo}" fill-opacity="${corpoOpac}"/>` +
    `<path d="${G.haste}" stroke="${hasteCor}" stroke-width="1.2" opacity="${hasteOpac}" stroke-linecap="round" fill="none"/>` +
    pata(c, patas, 1) +
    pata(l, patas, lateraisOpac) +
    pata(r, patas, lateraisOpac) +
    `<path d="${G.corpo}" stroke="${contorno}" stroke-width="1.5" fill="none" opacity="${contornoOpac}"/>` +
    `</g>`
  );
}

const svg = (n, fundo, corpoSvg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 ${n} ${n}">${fundo}${corpoSvg}</svg>`;

const centrado = (n, alturaFracao) => {
  const h = n * alturaFracao;
  const w = h * (G.vbW / G.vbH);
  return { x: (n - w) / 2, y: (n - h) / 2, w };
};

/**
 * Símbolo ocean (claro): corpo `ocean-pale` SÓLIDO (decisão C2), haste `ocean-soft`, patas `ocean`.
 * Os dois símbolos de SPLASH (claro e Noite) reproduzem exatamente o que `KuraMark` desenha no modo
 * `corpo`+`patas` usado pela `Abertura` (haste e patas a 100%, contorno a 70%): o 1º quadro da
 * abertura em JS tem de ser idêntico ao splash nativo, então isto vale mais que a fidelidade fina
 * ao canvas (que usava 85% nas laterais e 60% na haste Noite).
 */
const simboloOceanClaro = (pos) =>
  simbolo({
    ...pos,
    corpo: T.claro.primaryPale,
    hasteCor: T.claro.primarySoft,
    hasteOpac: 1,
    patas: T.claro.primary,
    contorno: T.claro.primary,
    contornoOpac: 0.7,
    lateraisOpac: 1,
  });

/** Símbolo ocean (Noite): corpo `primaryPale` escuro, haste/patas/contorno em `primary` Noite (canvas Main). */
const simboloOceanNoite = (pos) =>
  simbolo({
    ...pos,
    corpo: T.escuro.primaryPale,
    hasteCor: T.escuro.primary,
    hasteOpac: 1,
    patas: T.escuro.primary,
    contorno: T.escuro.primary,
    contornoOpac: 0.7,
    lateraisOpac: 1,
  });

/** Símbolo em knockout (texto-sobre-ocean) para ícone: canvas `Icones`. */
const simboloKnockout = (pos) =>
  simbolo({
    ...pos,
    corpo: T.claro.textOnPrimary,
    corpoOpac: 0.18,
    hasteCor: T.claro.textOnPrimary,
    hasteOpac: 0.6,
    patas: T.claro.textOnPrimary,
    contorno: T.claro.textOnPrimary,
    contornoOpac: 0.8,
  });

const N = 1024;
const SPLASH_ALTURA = 614 / 1024; // símbolo 512 de largura x 614 de altura num quadro 1024
const ALVOS = {
  // Ícone iOS/geral: fundo ocean opaco, símbolo a 50% da altura.
  'icon.png': () => ({
    svg: svg(N, `<rect width="${N}" height="${N}" fill="${T.claro.primary}"/>`, simboloKnockout(centrado(N, 0.5))),
    opaco: true,
    px: N,
  }),
  // Android adaptativo: fundo vem do app.json (backgroundColor); aqui só o primeiro plano,
  // símbolo a 38,4% da altura (canvas `Icones`) — cabe com folga na zona segura de 66%.
  'adaptive-icon.png': () => ({ svg: svg(N, '', simboloKnockout(centrado(N, 0.384))), opaco: false, px: N }),
  // Favicon 32: abaixo de 24 px só as patas (canvas `Icones`), sobre `primary`, canto 7/32.
  'favicon.png': () => {
    const [c, l, r] = G.circulos;
    const pata = (ci) => `<circle cx="${ci.cx - 8 + 4}" cy="${ci.cy - 2 + 9}" r="${ci.r}" fill="${T.claro.textOnPrimary}"/>`;
    return {
      svg:
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
        `<rect width="32" height="32" rx="7" fill="${T.claro.primary}"/>${pata(c)}${pata(l)}${pata(r)}</svg>`,
      opaco: false,
      px: 32,
    };
  },
  // Splash: quadro 1024 transparente, símbolo centrado (512x614), SEM texto. O `app.json`
  // dá a cor de fundo (bg do tema) e `imageWidth: 200` => símbolo de 100x120 dp, que a
  // `Abertura` reproduz com `KuraMark size={100}` centralizado.
  'splash-icon.png': () => ({ svg: svg(N, '', simboloOceanClaro(centrado(N, SPLASH_ALTURA))), opaco: false, px: N }),
  'splash-icon-dark.png': () => ({ svg: svg(N, '', simboloOceanNoite(centrado(N, SPLASH_ALTURA))), opaco: false, px: N }),
};

async function rasterizar({ svg: s, opaco, px }) {
  let img = sharp(Buffer.from(s), { density: 72 }).resize(px, px);
  if (opaco) img = img.flatten({ background: T.claro.primary });
  return img.png({ compressionLevel: 9 }).toBuffer();
}

async function pixels(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

const verificar = process.argv.includes('--verificar');
let divergencias = 0;
for (const [nome, fazer] of Object.entries(ALVOS)) {
  const buf = await rasterizar(fazer());
  const arquivo = resolve(ASSETS, nome);
  if (!verificar) {
    writeFileSync(arquivo, buf);
    console.log(`gravado ${nome} (${buf.length} bytes)`);
    continue;
  }
  if (!existsSync(arquivo)) {
    console.log(`AUSENTE ${nome}`);
    divergencias++;
    continue;
  }
  const a = await pixels(buf);
  const b = await pixels(readFileSync(arquivo));
  let maior = 0;
  if (a.w !== b.w || a.h !== b.h) maior = 255;
  else for (let i = 0; i < a.data.length; i++) maior = Math.max(maior, Math.abs(a.data[i] - b.data[i]));
  // Tolerância 2/255 por canal: absorve diferença de build do libvips entre máquinas, não de desenho.
  const ok = maior <= 2;
  console.log(`${ok ? 'ok' : 'DIVERGE'} ${nome} (maior diferença por canal: ${maior})`);
  if (!ok) divergencias++;
}
if (verificar) {
  console.log(divergencias === 0 ? 'assets em dia' : `${divergencias} asset(s) divergente(s) — rode node scripts/gerar-assets.mjs`);
  process.exit(divergencias === 0 ? 0 : 1);
}
