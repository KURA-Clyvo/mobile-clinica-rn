// BR-CLI-T07 fix wave (G2 I-1/I-2) -- destaque identico ao casamento do motor da Luna.
// Ancora: kura-luna-ai/luna/src/ai/triage_engine.py:22,31-51 @ e011335, 2026-10-11
// (`sed -n '22p;31,51p' luna/src/ai/triage_engine.py`): token [a-z0-9]+, sequencia contigua.
import { destacarTrecho } from '../src/utils/triagem';

const marcados = (t: string, p: string[]) =>
  destacarTrecho(t, p)
    .filter((s) => s.destaque)
    .map((s) => s.texto);
const remontado = (t: string, p: string[]) =>
  destacarTrecho(t, p)
    .map((s) => s.texto)
    .join('');

describe('destacarTrecho -- fronteira de token (I-2)', () => {
  it.each([
    ['choveu muita chuva hoje', 'uva'],
    ['quebrou o prato', 'rato'],
    ['usei o termômetro', 'metro'],
  ])('nao expande substring: "%s" com "%s" nao destaca nada', (texto, kw) => {
    expect(marcados(texto, [kw])).toEqual([]);
  });
  it('mas destaca a palavra quando ela e um token ("comeu uva")', () => {
    expect(marcados('comeu uva ontem', ['uva'])).toEqual(['uva']);
  });
  it('sequencia contigua de tokens ("tremendo muito")', () => {
    expect(marcados('Ele esta tremendo muito!', ['tremendo muito'])).toEqual(['tremendo muito']);
    expect(marcados('tremendo bastante muito', ['tremendo muito'])).toEqual([]);
  });
});

describe('destacarTrecho -- emoji e NFD (I-1)', () => {
  it('emoji antes da palavra', () => {
    expect(marcados('😢 teve convulsão', ['convulsão'])).toEqual(['convulsão']);
    expect(remontado('😢 teve convulsão', ['convulsão'])).toBe('😢 teve convulsão');
  });
  it('dois emojis', () => {
    expect(marcados('😢😢 teve convulsão agora', ['convulsao'])).toEqual(['convulsão']);
  });
  it('emoji colado a palavra', () => {
    expect(marcados('😢convulsão😢', ['convulsão'])).toEqual(['convulsão']);
    expect(remontado('😢convulsão😢', ['convulsão'])).toBe('😢convulsão😢');
  });
  it('nunca corta surrogate', () => {
    const segs = destacarTrecho('🐶🐶 vomitou 🐶', ['vomitou']);
    for (const s of segs) expect(s.texto).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });
  it('acento decomposto (NFD) casa e o destaque inclui a marca', () => {
    const nfd = 'teve convulsão'.normalize('NFD');
    const segs = marcados('Teve convulsão'.normalize('NFD'), ['convulsao']);
    expect(segs).toEqual(['convulsão'.normalize('NFD')]);
    expect(marcados(nfd, ['convulsão'])).toHaveLength(1);
  });
});
