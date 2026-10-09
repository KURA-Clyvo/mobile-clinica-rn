// BR-CLI-T02 — gate: nenhum `Alert.alert` (nem import de `Alert` de react-native) em src/.
// No web `Alert.alert` é no-op (react-native-web/dist/exports/Alert/index.js), então qualquer
// ocorrência volta a tornar uma ação inalcançável. Use confirmar()/avisar()/useToast().
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', 'src');

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') arquivos(p, acc);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) acc.push(p);
  }
  return acc;
}

// Tira comentários (bloco e linha inteira) para que comentário histórico não dispare o gate.
function semComentarios(txt: string): string {
  return txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const PROIBIDO = [
  /\bAlert\s*\.\s*alert\s*\(/,
  /import\s*\{[^}]*\bAlert\b[^}]*\}\s*from\s*['"]react-native['"]/,
];
const proibido = (txt: string) => PROIBIDO.some((re) => re.test(semComentarios(txt)));

describe('gate: 0 Alert.alert em src/', () => {
  it('a varredura enxerga arquivos (controle: acha o ConfirmHost)', () => {
    const todos = arquivos(SRC);
    expect(todos.length).toBeGreaterThan(50);
    expect(todos.some((f) => f.endsWith(path.join('feedback', 'ConfirmHost.tsx')))).toBe(true);
  });

  it('o regex pega as iscas (controle positivo)', () => {
    expect(proibido("Alert.alert('x');")).toBe(true);
    expect(proibido("  Alert\n    .alert('x')")).toBe(true);
    expect(proibido("import { View, Alert } from 'react-native';")).toBe(true);
    expect(proibido("import {\n  Alert,\n  View,\n} from 'react-native';")).toBe(true);
    // não-iscas
    expect(proibido("import { AlertCard } from './AlertCard';")).toBe(false);
    expect(proibido("// Alert.alert('x') era assim\nconst a = 1;")).toBe(false);
    expect(proibido("/* Alert.alert('x') */ const a = 1;")).toBe(false);
  });

  it('nenhum arquivo de src/ usa Alert.alert ou importa Alert de react-native', () => {
    const achados = arquivos(SRC)
      .filter((f) => proibido(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC, f));
    expect(achados).toEqual([]);
  });
});
