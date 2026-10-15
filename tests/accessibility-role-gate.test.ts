// BR-CLI-G4 (achado 1): `accessibilityRole` com valor fora da lista do RN 0.81 derruba o Android
// ("Invalid accessibility role value"). O tipo do RN termina em `| string`, então o type-check não
// pega -- este gate varre src/ e falha em qualquer literal fora da lista nativa.
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', 'src');
// Lista de ViewAccessibility.js (AccessibilityRole) do RN 0.81, menos o `string` aberto.
const VALIDOS = new Set([
  'none', 'button', 'dropdownlist', 'togglebutton', 'link', 'search', 'image', 'keyboardkey', 'text',
  'adjustable', 'imagebutton', 'header', 'summary', 'alert', 'checkbox', 'combobox', 'menu',
  'menubar', 'menuitem', 'progressbar', 'radio', 'radiogroup', 'scrollbar', 'spinbutton', 'switch',
  'tab', 'tabbar', 'tablist', 'timer', 'list', 'toolbar', 'grid', 'pager', 'scrollview',
  'horizontalscrollview', 'viewgroup', 'webview', 'drawerlayout', 'slidingdrawer', 'iconmenu',
]);

// accessibilityRole="x" | ={'x'} | ={"x" as never} | ={cond ? 'a' : 'b'} -> todos os literais da expressão
const ATRIBUTO = /accessibilityRole=(?:"([^"]*)"|\{([^{}]*)\})/g;
const LITERAL = /'([^']*)'|"([^"]*)"/g;

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

export const invalidos = (entrada: string): string[] => {
  const texto = semComentarios(entrada);
  const fora: string[] = [];
  for (const m of texto.matchAll(ATRIBUTO)) {
    const valores =
      m[1] !== undefined ? [m[1]] : [...m[2].matchAll(LITERAL)].map((l) => l[1] ?? l[2]);
    for (const v of valores) if (!VALIDOS.has(v)) fora.push(v);
  }
  return fora;
};

const arquivos = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivos(p);
    return /\.tsx$/.test(e.name) ? [p] : [];
  });

describe('gate: accessibilityRole só com valor nativo válido', () => {
  it('o detector pega o valor plantado (controle positivo)', () => {
    expect(invalidos(`<View accessibilityRole={'alertdialog' as never} />`)).toEqual(['alertdialog']);
    expect(invalidos(`<View accessibilityRole="alertdialog" />`)).toEqual(['alertdialog']);
    expect(invalidos(`<View accessibilityRole={x ? 'button' : 'dialog'} />`)).toEqual(['dialog']);
    expect(invalidos(`<View accessibilityRole="button" />`)).toEqual([]);
  });

  it('nenhum arquivo de src usa role inválido', () => {
    const ruins = arquivos(SRC).flatMap((f) =>
      invalidos(fs.readFileSync(f, 'utf8')).map((v) => `${path.relative(SRC, f)}: ${v}`),
    );
    expect(ruins).toEqual([]);
  });
});
