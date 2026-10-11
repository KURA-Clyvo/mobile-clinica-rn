// BR-CLI-T07 -- card de triagem auditavel (canvas ClinicaTriagem v13).
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { TriagemCard } from '../src/components/domain/TriagemCard';
import { destacarTrecho, rotuloSintoma } from '../src/utils/triagem';
import type { TriagemListaItem } from '../src/types/api';

const ITEM: TriagemListaItem = {
  idTriagem: 7,
  dtTriagem: new Date(Date.now() - 12 * 60 * 1000),
  urgencia: 'ALTA',
  sintomas: ['convulsão'],
  score: 13,
  regrasVersao: '1.4',
  encaminhadoVet: true,
  tutor: { id: 1, nome: 'Ana' },
  pets: [{ id: 2, nome: 'Thor', especie: 'Cão' }],
  trechoMensagem: 'Ele teve uma convulsão hoje cedo e depois vomitou duas vezes.',
};

const mostrar = (item: TriagemListaItem) =>
  render(
    <ThemeProvider>
      <TriagemCard item={item} />
    </ThemeProvider>,
  );

describe('TriagemCard (BR-CLI-T07)', () => {
  it('mostra nivel, palavra destacada dentro da mensagem, score e versao das regras', () => {
    const { getByTestId, getAllByTestId, queryByText, getByText } = mostrar(ITEM);
    expect(getByText('Alta')).toBeTruthy();
    const destaques = getAllByTestId('fila-destaque-7');
    expect(destaques).toHaveLength(1);
    expect(destaques[0]!.props.children).toBe('convulsão');
    expect(getByTestId('fila-score-7').props.children).toBe(13);
    expect(getByTestId('fila-regras-7').props.children).toBe('regras 1.4');
    expect(queryByText(/Abrir conversa/)).toBeNull();
    expect(queryByText(/versão 1\.0/)).toBeNull();
  });

  it('o destaque ignora caixa e acento ("CONVULSAO" casa "convulsão")', () => {
    const { getByTestId } = mostrar({ ...ITEM, trechoMensagem: 'Teve CONVULSAO agora' });
    expect(getByTestId('fila-destaque-7').props.children).toBe('CONVULSAO');
  });

  it('palavra que nao esta no trecho: sem destaque, so o chip "disparou: ..."', () => {
    const { queryByTestId, getByTestId } = mostrar({ ...ITEM, trechoMensagem: 'Ele esta quieto.' });
    expect(queryByTestId('fila-destaque-7')).toBeNull();
    expect(getByTestId('fila-disparou-7')).toBeTruthy();
  });

  it('com destaque no trecho, nao repete o chip "disparou"', () => {
    const { queryByTestId } = mostrar(ITEM);
    expect(queryByTestId('fila-disparou-7')).toBeNull();
  });

  it('tocar o card expande a mensagem inteira e a nota de que a pontuacao soma todos os niveis', () => {
    const { getByTestId, queryByTestId, getByText } = mostrar(ITEM);
    expect(getByTestId('fila-trecho-7').props.numberOfLines).toBe(2);
    expect(queryByTestId('fila-detalhe-7')).toBeNull();
    fireEvent.press(getByTestId('fila-toque-7'));
    expect(getByTestId('fila-trecho-7').props.numberOfLines).toBeUndefined();
    expect(getByTestId('fila-detalhe-7')).toBeTruthy();
    expect(getByText(/soma tudo o que a Luna reconheceu/)).toBeTruthy();
    expect(getByTestId('fila-toque-7').props.accessibilityState).toEqual({ expanded: true });
  });

  it('score/regras nulos nao viram "null" nem versao inventada', () => {
    const { queryByTestId, queryByText } = mostrar({ ...ITEM, score: null, regrasVersao: null });
    expect(queryByTestId('fila-score-7')).toBeNull();
    expect(queryByTestId('fila-regras-7')).toBeNull();
    expect(queryByText(/null/)).toBeNull();
  });

  it('o codigo le regrasVersao do item (nenhuma versao fixa no codigo)', () => {
    const raiz = path.join(__dirname, '..', 'src');
    const txt = ['components/domain/TriagemCard.tsx', 'app/(app)/luna.tsx']
      .map((f) => fs.readFileSync(path.join(raiz, f), 'utf8'))
      .join('\n');
    expect(txt).toMatch(/regrasVersao/);
    expect(txt).not.toMatch(/['"`]1\.[0-9]['"`]/);
  });
});

describe('destacarTrecho', () => {
  it('varias ocorrencias, insensivel a acento e caixa', () => {
    const segs = destacarTrecho('vomito, outro e VÔMITO', ['vômito']);
    expect(segs.filter((s) => s.destaque).map((s) => s.texto)).toEqual(['vomito', 'VÔMITO']);
    expect(segs.map((s) => s.texto).join('')).toBe('vomito, outro e VÔMITO');
  });
  it('casa por token inteiro, como o motor: "vomito" NAO destaca "vomitou" (a API devolve a palavra casada)', () => {
    expect(destacarTrecho('Ele vomitou duas vezes.', ['vômito']).some((s) => s.destaque)).toBe(false);
    const segs = destacarTrecho('Ele vomitou duas vezes.', ['vomitou']);
    expect(segs.filter((s) => s.destaque).map((s) => s.texto)).toEqual(['vomitou']);
  });
  it('sem palavras devolve o texto inteiro sem destaque', () => {
    expect(destacarTrecho('abc', [])).toEqual([{ texto: 'abc', destaque: false }]);
  });
});

describe('combinacao:{categoria} (G2 M-5)', () => {
  const COMB: TriagemListaItem = {
    ...ITEM,
    sintomas: ['combinacao:ingestao_toxica'],
    trechoMensagem: 'Ela comeu chocolate ontem a noite.',
  };
  it('rotuloSintoma: categorias conhecidas e desconhecida legiveis, palavra comum intacta', () => {
    expect(rotuloSintoma('combinacao:ingestao_toxica')).toBe('combinação: ingestão de algo tóxico');
    expect(rotuloSintoma('combinacao:picada_mordida')).toBe('combinação: picada ou mordida');
    expect(rotuloSintoma('combinacao:queda_altura')).toBe('combinação: queda de altura');
    expect(rotuloSintoma('combinacao:nova_categoria')).toBe('combinação: nova categoria');
    expect(rotuloSintoma('vomitou')).toBe('vomitou');
  });
  it('nunca destaca a categoria no trecho', () => {
    expect(destacarTrecho('ingestao toxica combinacao', ['combinacao:ingestao_toxica']).some((s) => s.destaque)).toBe(false);
  });
  it('o card mostra texto humano em "disparou" e em "O que subiu", sem o literal cru', () => {
    const { getByTestId, queryByText, getByText } = mostrar(COMB);
    expect(getByTestId('fila-disparou-7')).toBeTruthy();
    expect(getByText(/combinação: ingestão de algo tóxico/)).toBeTruthy();
    fireEvent.press(getByTestId('fila-toque-7'));
    expect(getByText(/O que subiu este caso: combinação: ingestão de algo tóxico/)).toBeTruthy();
    expect(queryByText(/combinacao:/)).toBeNull();
    expect(queryByText(/ingestao_toxica/)).toBeNull();
  });
});
