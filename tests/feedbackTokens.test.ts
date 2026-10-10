// BR-CLI-T02 fix wave (I-1): ConfirmHost e Toast não podem ter número/fonte literal onde o DS
// tem token (fontSize, raio, padding, gap, margin, fontFamily). Valores vêm de
// `src/theme/tokens.ts` (spacing/radius/fontSize/fonts/touchTarget) ou `typography.ts`.
import fs from 'fs';
import path from 'path';

const ARQS = ['ConfirmHost.tsx', 'Toast.tsx', 'QueryState.tsx', 'ErrorState.tsx', 'Skeleton.tsx'].map((f) =>
  path.join(__dirname, '..', 'src', 'components', 'feedback', f),
);

// propriedade visual seguida de literal numérico ou de string (aspas), em vez de token/expressão.
const LITERAL =
  /\b(fontSize|borderRadius|border(?:Top|Bottom)?(?:Left|Right)?Radius|padding\w*|gap|margin\w*|fontFamily|lineHeight)\s*:\s*(?:-?\d|['"`])/;

const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const achados = (t: string) =>
  semComentarios(t)
    .split('\n')
    .filter((l) => LITERAL.test(l));

describe('gate: feedback sem valor visual literal', () => {
  it('a varredura enxerga os 5 arquivos (controle)', () => {
    for (const f of ARQS) expect(fs.readFileSync(f, 'utf8')).toMatch(/StyleSheet\.create/);
  });

  it('o regex pega as iscas (controle positivo)', () => {
    expect(achados('a: { fontSize: 14 }')).toHaveLength(1);
    expect(achados("a: { fontFamily: 'Lexend_500Medium' }")).toHaveLength(1);
    expect(achados('a: { borderRadius: 14, padding: 20 }')).toHaveLength(1);
    expect(achados('a: { gap: 8 }')).toHaveLength(1);
    expect(achados('a: { padding: spacing[5], fontSize: fontSize.md }')).toHaveLength(0);
  });

  it.each(ARQS.map((f) => [path.basename(f), f]))('%s: 0 literais', (_n, f) => {
    expect(achados(fs.readFileSync(f, 'utf8'))).toEqual([]);
  });
});
