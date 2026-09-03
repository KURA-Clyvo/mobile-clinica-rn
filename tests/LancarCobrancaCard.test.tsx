import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { LancarCobrancaCard } from '../src/components/domain/LancarCobrancaCard';
import type { ServicoPrecoResponse, CobrancaResponse } from '../src/types/api';

// FM-06 -- mesmo padrão de ServicoPrecoFormModal.test.tsx/
// UsuarioClinicaFormModal.test.tsx: mocka os HOOKS de dados (não o service
// nem o mock-adapter -- aquilo é coberto por mock-contract-audit.test.ts/
// mock-adapter.test.ts), exercitando o COMPONENTE de verdade.
const mockMutateLancar = jest.fn();
jest.mock('@hooks/useCobrancas', () => ({
  useLancarCobranca: () => ({ mutate: mockMutateLancar, isPending: false }),
}));

const mockInvalidateQueries = jest.fn();
// `LancarCobrancaCard` chama `useQueryClient()` DIRETO (não só através de
// um hook próprio, como servicos-preco/useServicosPreco) para invalidar a
// lista no 422 de serviço desativado -- precisa deste mock, ou o teste
// precisaria de um QueryClientProvider real de verdade sem nenhum ganho.
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

let mockServicos: ServicoPrecoResponse[] = [];
jest.mock('@hooks/useServicosPreco', () => ({
  useServicosPreco: () => ({ data: mockServicos }),
}));

const SERVICO_A: ServicoPrecoResponse = {
  id: 1,
  idClinica: 1,
  nmServico: 'Consulta de rotina',
  vlPreco: 150,
  stAtiva: true,
  dtCriacao: '2026-08-01T10:00:00Z',
  dtAtualizacao: null,
};
const SERVICO_B: ServicoPrecoResponse = {
  id: 2,
  idClinica: 1,
  nmServico: 'Vacina V10',
  vlPreco: 90.5,
  stAtiva: true,
  dtCriacao: '2026-08-01T10:00:00Z',
  dtAtualizacao: null,
};

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockServicos = [SERVICO_A, SERVICO_B];
});

describe('LancarCobrancaCard — baixo atrito (brief §1)', () => {
  it('botão começa DESABILITADO sem nenhuma origem de valor (nem serviço, nem valor avulso)', () => {
    const { getByTestId } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    expect(getByTestId('btn-lancar-cobranca').props.accessibilityState?.disabled).toBe(true);
  });

  // Corpo mínimo do gesto desenhado (brief §3.3): tocar UM serviço já
  // habilita o envio, sem digitar valor nenhum.
  it('tocar um chip de serviço HABILITA o botão sem exigir valor digitado', () => {
    const { getByTestId } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.press(getByTestId('chip-servico-1'));
    expect(getByTestId('btn-lancar-cobranca').props.accessibilityState?.disabled).toBeFalsy();
  });

  it('tocar o MESMO chip de novo desmarca o serviço e volta a desabilitar o botão', () => {
    const { getByTestId } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.press(getByTestId('chip-servico-1'));
    fireEvent.press(getByTestId('chip-servico-1'));
    expect(getByTestId('btn-lancar-cobranca').props.accessibilityState?.disabled).toBe(true);
  });

  it('digitar um valor avulso válido, SEM selecionar serviço, também habilita o botão', () => {
    const { getByTestId } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.changeText(getByTestId('input-valor-cobranca'), '37,50');
    expect(getByTestId('btn-lancar-cobranca').props.accessibilityState?.disabled).toBeFalsy();
  });

  // Mordida das regras de 400 replicadas client-side (CobrancaCreateValidator.cs).
  it('valor avulso inválido (texto) mostra erro e MANTÉM o botão desabilitado', async () => {
    const { getByTestId, findByText } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.changeText(getByTestId('input-valor-cobranca'), 'abc');
    expect(await findByText('Informe um número válido')).toBeTruthy();
    expect(getByTestId('btn-lancar-cobranca').props.accessibilityState?.disabled).toBe(true);
  });

  it('valor avulso negativo mostra erro e desabilita', async () => {
    const { getByTestId, findByText } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.changeText(getByTestId('input-valor-cobranca'), '-5');
    expect(await findByText('Valor não pode ser negativo')).toBeTruthy();
    expect(getByTestId('btn-lancar-cobranca').props.accessibilityState?.disabled).toBe(true);
  });

  // ⚠️ A entrada deste teste mudou de `10.999` para `10,999` na fix wave da
  // G2 (M-4), e a razão é um achado do próprio maestro CONTRA o próprio fix:
  // `10.999` é AMBÍGUO — casa exatamente a forma "milhar pt-BR"
  // (`\d+` ponto 3 dígitos), e nenhuma heurística consegue distinguir
  // "dez mil novecentos e noventa e nove" de "10.999 com 3 decimais".
  // `10,999` (vírgula) é inequivocamente 3 casas decimais, então é a entrada
  // certa para vigiar a mensagem GENÉRICA.
  //
  // 🔴 O erro não foi o fix, foi o teste ter sido escrito com a única
  // entrada que os dois ramos disputam — e ele só apareceu porque o fix
  // quebrou um teste que já existia. Um teste com entrada ambígua passa
  // enquanto só um dos ramos existe, e vira armadilha quando o segundo
  // chega.
  it('valor avulso com mais de 2 casas decimais mostra erro e desabilita', async () => {
    const { getByTestId, findByText } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.changeText(getByTestId('input-valor-cobranca'), '10,999');
    expect(await findByText('Valor deve ter no máximo 2 casas decimais')).toBeTruthy();
    expect(getByTestId('btn-lancar-cobranca').props.accessibilityState?.disabled).toBe(true);
  });

  // M-4 da G2. O par com o teste acima é o ponto: a vírgula com 3 dígitos
  // recebe a mensagem genérica, e só a forma "milhar pt-BR" (ponto seguido
  // de exatamente 3 dígitos) ganha a instrução. Sem este par, uma
  // "simplificação" futura que devolvesse a mensagem nova para todo caso
  // passaria despercebida.
  it('valor com separador de MILHAR (2.500) é barrado com instrução, não com a mensagem genérica', async () => {
    const { getByTestId, findByText } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.changeText(getByTestId('input-valor-cobranca'), '2.500');
    expect(await findByText('Use vírgula para os centavos (ex.: 2500,00)')).toBeTruthy();
    // Continua BARRADO: a instrução melhor não afrouxa a regra. O valor
    // nunca sai errado — é a direção segura da falha.
    expect(getByTestId('btn-lancar-cobranca').props.accessibilityState?.disabled).toBe(true);
  });

  it('valor com vírgula decimal (45,90) é ACEITO e habilita — controle positivo da regra acima', async () => {
    const { getByTestId } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.changeText(getByTestId('input-valor-cobranca'), '45,90');
    expect(getByTestId('btn-lancar-cobranca').props.accessibilityState?.disabled).toBeFalsy();
  });
});

describe('LancarCobrancaCard — envio', () => {
  it('serviço selecionado, sem override de valor: envia idServicoPreco e vlCobrado UNDEFINED (backend copia o preço)', async () => {
    const { getByTestId } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.press(getByTestId('chip-servico-1'));

    await act(async () => {
      fireEvent.press(getByTestId('btn-lancar-cobranca'));
    });

    expect(mockMutateLancar).toHaveBeenCalledWith(
      {
        idEventoClinico: 42,
        req: { idServicoPreco: 1, vlCobrado: undefined, dsFormaPagamento: undefined },
      },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  // Override (D-2): serviço selecionado E valor digitado -- os DOIS vão no
  // corpo, o backend decide o vencedor (ResolverValor).
  it('serviço selecionado COM override de valor: envia os dois campos', async () => {
    const { getByTestId } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.press(getByTestId('chip-servico-1'));
    fireEvent.changeText(getByTestId('input-valor-cobranca'), '120,00');

    await act(async () => {
      fireEvent.press(getByTestId('btn-lancar-cobranca'));
    });

    expect(mockMutateLancar).toHaveBeenCalledWith(
      expect.objectContaining({
        req: expect.objectContaining({ idServicoPreco: 1, vlCobrado: 120 }),
      }),
      expect.anything(),
    );
  });

  // ─── I-1 da revisão G2 — o lado COMPONENTE da mordida do zero ───────────
  //
  // O par desta mordida vive em `tests/mock-contract-audit.test.ts` (o lado
  // MOCK). Os dois são necessários e não se substituem: a G2 mutou `??`→`||`
  // em `LancarCobrancaCard.tsx:184` e em `cobrancas.mock.ts:171`
  // SEPARADAMENTE, e as DUAS mutações sobreviveram verdes. Um teste só
  // deixaria metade da cadeia sem rede.
  //
  // 🔴 Aqui o que se protege é o CORPO ENVIADO: com `|| undefined`, o `0`
  // digitado vira `vlCobrado: undefined`, e o backend copia o preço cheio da
  // tabela (ResolverValor). Cortesia registrada, tutor cobrado — sem erro
  // nenhum. Por isso a asserção é `vlCobrado: 0` explícito, e não
  // `objectContaining` de um valor positivo qualquer.
  it('serviço selecionado com valor ZERO (cortesia): envia vlCobrado 0, NÃO undefined -- mordida I-1', async () => {
    const { getByTestId } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.press(getByTestId('chip-servico-1'));
    fireEvent.changeText(getByTestId('input-valor-cobranca'), '0');

    // Controle positivo: o zero tem que HABILITAR o envio. Se o gate
    // tratasse `0` como "sem origem de valor", o botão ficaria desabilitado
    // e o `expect` seguinte falharia por um motivo diferente do que este
    // teste existe para vigiar.
    expect(getByTestId('btn-lancar-cobranca').props.accessibilityState?.disabled).toBeFalsy();

    await act(async () => {
      fireEvent.press(getByTestId('btn-lancar-cobranca'));
    });

    const [[chamada]] = mockMutateLancar.mock.calls;
    expect(chamada.req.vlCobrado).toBe(0);
    expect(chamada.req.vlCobrado).not.toBeUndefined();
    expect(chamada.req.idServicoPreco).toBe(1);
  });

  it('chip de forma de pagamento preenche o campo de texto livre, e é enviado', async () => {
    const { getByTestId } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.changeText(getByTestId('input-valor-cobranca'), '10');
    fireEvent.press(getByTestId('chip-forma-Pix'));

    await act(async () => {
      fireEvent.press(getByTestId('btn-lancar-cobranca'));
    });

    expect(mockMutateLancar).toHaveBeenCalledWith(
      expect.objectContaining({ req: expect.objectContaining({ dsFormaPagamento: 'Pix' }) }),
      expect.anything(),
    );
  });

  it('sucesso: mostra confirmação LOCAL com o valor da resposta (nunca um GET)', async () => {
    const resposta: CobrancaResponse = {
      id: 900,
      idEventoClinico: 42,
      idClinica: 1,
      idServicoPreco: 1,
      vlCobrado: 150,
      dsFormaPagamento: 'Pix',
      dtCobranca: '2026-09-03T10:00:00Z',
      stAtiva: true,
      dtCriacao: '2026-09-03T10:00:00Z',
      dtAtualizacao: null,
    };
    mockMutateLancar.mockImplementation((_vars, { onSuccess }) => onSuccess(resposta));

    const { getByTestId, findByTestId, findByText, queryByTestId } = wrap(
      <LancarCobrancaCard idEventoClinico={42} />,
    );
    fireEvent.press(getByTestId('chip-servico-1'));

    await act(async () => {
      fireEvent.press(getByTestId('btn-lancar-cobranca'));
    });

    expect(await findByTestId('cobranca-confirmacao')).toBeTruthy();
    expect(await findByText('Cobrança de R$ 150,00 lançada')).toBeTruthy();
    // Formulário sai de cena -- não existe mais botão de enviar até
    // "Lançar outra cobrança" ser tocado.
    expect(queryByTestId('btn-lancar-cobranca')).toBeNull();
  });

  it('"Lançar outra cobrança" reabre o formulário limpo (sem nenhuma chamada de rede)', async () => {
    const resposta: CobrancaResponse = {
      id: 901,
      idEventoClinico: 42,
      idClinica: 1,
      idServicoPreco: null,
      vlCobrado: 37.5,
      dsFormaPagamento: null,
      dtCobranca: '2026-09-03T10:00:00Z',
      stAtiva: true,
      dtCriacao: '2026-09-03T10:00:00Z',
      dtAtualizacao: null,
    };
    mockMutateLancar.mockImplementation((_vars, { onSuccess }) => onSuccess(resposta));

    const { getByTestId, findByTestId } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.changeText(getByTestId('input-valor-cobranca'), '37,50');
    await act(async () => {
      fireEvent.press(getByTestId('btn-lancar-cobranca'));
    });
    await findByTestId('cobranca-confirmacao');

    fireEvent.press(getByTestId('btn-lancar-outra-cobranca'));

    expect(getByTestId('btn-lancar-cobranca')).toBeTruthy();
    expect(getByTestId('input-valor-cobranca').props.value).toBe('');
  });

  it('422 SERVICO_DESATIVADO: Alert com a mensagem do backend, desmarca o serviço e invalida a query servicos-preco', async () => {
    const spyAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockMutateLancar.mockImplementation((_vars, { onError }) =>
      onError({
        status: 422,
        code: 'SERVICO_DESATIVADO',
        message:
          'Este serviço de preço está DESATIVADO e não pode originar novos lançamentos. ' +
          'Reative-o na tabela de preços, ou lance a cobrança com vlCobrado avulso.',
      }),
    );

    const { getByTestId } = wrap(<LancarCobrancaCard idEventoClinico={42} />);
    fireEvent.press(getByTestId('chip-servico-1'));

    await act(async () => {
      fireEvent.press(getByTestId('btn-lancar-cobranca'));
    });

    expect(spyAlert).toHaveBeenCalledWith(
      'Erro',
      'Este serviço de preço está DESATIVADO e não pode originar novos lançamentos. ' +
        'Reative-o na tabela de preços, ou lance a cobrança com vlCobrado avulso.',
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['servicos-preco'] });
    // Sem confirmação local nenhuma -- o lançamento NÃO aconteceu.
    expect(() => getByTestId('cobranca-confirmacao')).toThrow();
    spyAlert.mockRestore();
  });
});
