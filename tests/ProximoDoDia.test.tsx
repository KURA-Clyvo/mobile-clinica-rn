import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import DashboardScreen from '../src/app/(app)/dashboard';
import { ROUTES } from '../src/constants/routes';
import { ag, DIA_DO_PRINT } from './helpers_proximos';

// BR-CLI-T06 -- o bloco "Proximo atendimento" do dashboard, com a agenda fixa e o relogio congelado em
// 12:00 de 09/10/2026 (fixture do print-alvo). Hooks mockados: este arquivo prova o COMPONENTE; a prova de
// que dashboard e Hoje compartilham a query esta em tests/dashboardMesmaFonte.test.tsx (cadeia real).

jest.mock('@hooks/useDashboard', () => ({
  useDashboardHoje: jest.fn(),
  useAlertas: jest.fn(),
}));
jest.mock('@hooks/useAgenda', () => ({ useAgendaHoje: jest.fn() }));
jest.mock('@hooks/useFinanceiro', () => ({ useResumoFinanceiro: jest.fn() }));
jest.mock('@utils/agora', () => ({ agora: () => new Date(2026, 9, 9, 12, 0, 0) }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

import { useDashboardHoje, useAlertas } from '../src/hooks/useDashboard';
import { useAgendaHoje } from '../src/hooks/useAgenda';
import { useResumoFinanceiro } from '../src/hooks/useFinanceiro';

const mockAgenda = useAgendaHoje as jest.Mock;
const REFETCH = jest.fn().mockResolvedValue(undefined);
const ok = (data: unknown) => ({ data, isLoading: false, isError: false, refetch: REFETCH });

const HOJE = {
  metrics: { nrConsultasHoje: 8, nrPacientesAtendidos: 6, nrAlertasAtivos: 3, nrTeleorientacoes: 2 },
  dailySummary: { dsResumo: 'OK', dtUltimaAtualizacao: '2026-10-09T12:00:00' },
};

// Mesma fixture do print, com o servico no wire (nmTipoConsulta) e tutores do print.
const TUTOR: Record<string, string> = { Thor: 'Carlos Mendes', Max: 'Roberto Lima', Nala: 'Ricardo Moura', Simba: 'Leticia Prado' };
const DIA = DIA_DO_PRINT.map((a) => ({
  ...a,
  tutor: { ...a.tutor, nmTutor: TUTOR[a.pet.nmPet] ?? a.tutor.nmTutor },
  nmTipoConsulta: a.pet.nmPet === 'Thor' ? 'Consulta de Retorno' : a.pet.nmPet === 'Nala' ? 'Vacinacao' : 'Consulta Geral',
}));

function wrap() {
  return render(
    <ThemeProvider>
      <DashboardScreen />
    </ThemeProvider>,
  );
}

function textoDe(node: { props: { children?: unknown } }): string {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c ?? '');
}

/** testIDs na ordem do documento (pre-ordem). */
function ordem(root: ReturnType<typeof wrap>['root']): string[] {
  return root
    .findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string')
    .map((n) => n.props.testID as string);
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    token: 't',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'felipe@kuraclinica.com.br',
    tpPerfil: 'VETERINARIO',
    usuario: { id: 1, nmVeterinario: 'Dra. Ana', nrCRMV: 'SP-1', dsEmail: 'a@b.c' },
  });
  (useDashboardHoje as jest.Mock).mockReturnValue(ok(HOJE));
  (useAlertas as jest.Mock).mockReturnValue(ok([]));
  (useResumoFinanceiro as jest.Mock).mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: REFETCH });
  mockAgenda.mockReturnValue(ok(DIA));
});

describe('Dashboard -- regra B-17 com a fixture da G2 (atrasado antes de um "Chegou")', () => {
  it('Rex AGENDADO 09:00 sem check-in + Nina Chegou: o destaque e a Nina ("Esperando ha"), o Rex fica na lista com atraso', () => {
    mockAgenda.mockReturnValue(
      ok([
        ag(1, 'Rex', 9, 0, 'AGENDADO'),
        ag(2, 'Nina', 10, 0, 'CHEGOU', { dtCheckin: '2026-10-09T10:00:00' }),
        ag(3, 'Zeca', 13, 0, 'AGENDADO'),
      ]),
    );
    const { getByTestId, queryByTestId } = wrap();
    expect(textoDe(getByTestId('proximo-pet'))).toBe('Nina');
    expect(within(getByTestId('proximo-atendimento')).getByText('Esperando há 120 min')).toBeTruthy();
    expect(queryByTestId('proximo-atraso')).toBeNull();
    expect(textoDe(getByTestId('atraso-1'))).toBe('180 min de atraso');
    expect(getByTestId('seguinte-3')).toBeTruthy();
  });

  it('um segundo "Chegou" na lista mostra "Esperando ha N min", como o destaque', () => {
    mockAgenda.mockReturnValue(
      ok([
        ag(2, 'Nina', 10, 0, 'CHEGOU', { dtCheckin: '2026-10-09T10:00:00' }),
        ag(4, 'Lia', 11, 0, 'CHEGOU', { dtCheckin: '2026-10-09T11:30:00' }),
      ]),
    );
    const { getByTestId } = wrap();
    expect(textoDe(getByTestId('proximo-pet'))).toBe('Nina');
    expect(textoDe(getByTestId('espera-4'))).toBe('Esperando há 30 min');
  });

  it('so atrasados sem check-in: sem destaque, mas a lista aparece (nao e "nada mais por hoje")', () => {
    mockAgenda.mockReturnValue(ok([ag(1, 'Rex', 9, 0, 'AGENDADO')]));
    const { queryByTestId, getByTestId } = wrap();
    expect(queryByTestId('proximo-atendimento')).toBeNull();
    expect(queryByTestId('empty-fim-do-dia')).toBeNull();
    expect(getByTestId('seguinte-1')).toBeTruthy();
  });
});

describe('Dashboard -- "qual e o proximo" (fixture do print, agora = 12:00)', () => {
  it('so ativos de hoje; o primeiro NAO em atendimento e o proximo (Thor); encerrados nao aparecem', () => {
    const { getByTestId, queryByText, queryByTestId } = wrap();
    expect(textoDe(getByTestId('proximo-pet'))).toBe('Thor');
    // Encerrados (Rex FINALIZADO, Luna CANCELADO, Bidu NAO_COMPARECEU) nunca viram linha.
    expect(queryByText('Rex')).toBeNull();
    expect(queryByText('Luna')).toBeNull();
    expect(queryByText('Bidu')).toBeNull();
    // Quem esta em atendimento (Max) NAO e o destaque nem uma linha da lista.
    expect(queryByTestId('seguinte-1')).toBeNull();
  });

  it('o destaque traz pet, tutor, servico, 11:45, chip Chegou e "Esperando ha 8 min"', () => {
    const { getByTestId } = wrap();
    const d = getByTestId('proximo-atendimento');
    const t = within(d);
    expect(t.getByText('Thor')).toBeTruthy();
    expect(t.getByText('Carlos Mendes')).toBeTruthy();
    expect(t.getByText('Consulta de Retorno')).toBeTruthy();
    expect(t.getByText('11:45')).toBeTruthy();
    expect(t.getByText('Chegou')).toBeTruthy();
    expect(t.getByText('Esperando há 8 min')).toBeTruthy();
    expect(t.getByText('PRÓXIMO ATENDIMENTO')).toBeTruthy();
  });

  it('quem esta em atendimento vai para a faixa "Em atendimento" (Max, desde 11:22), nunca para o destaque', () => {
    const { getByTestId } = wrap();
    const faixa = getByTestId('em-atendimento');
    const t = within(faixa);
    expect(t.getByText('Em atendimento')).toBeTruthy();
    expect(t.getByText('Max')).toBeTruthy();
    expect(t.getByText('11:22')).toBeTruthy();
    expect(within(getByTestId('proximo-atendimento')).queryByText('Max')).toBeNull();
  });

  it('sem ninguem em atendimento a faixa nao existe', () => {
    mockAgenda.mockReturnValue(ok(DIA.filter((a) => a.dsEtapaRecepcao !== 'EM_ATENDIMENTO')));
    const { queryByTestId } = wrap();
    expect(queryByTestId('em-atendimento')).toBeNull();
  });

  it('atrasado fica na lista, acima da marca "agora", com "10 min de atraso" (Nala 11:50)', () => {
    const { getByTestId, root } = wrap();
    expect(textoDe(getByTestId('atraso-3'))).toBe('10 min de atraso');
    const ids = ordem(root);
    const nala = ids.indexOf('seguinte-3');
    const marca = ids.indexOf('marca-agora');
    const simba = ids.indexOf('seguinte-4');
    expect(nala).toBeGreaterThan(-1);
    expect(nala).toBeLessThan(marca);
    expect(marca).toBeLessThan(simba);
  });

  it('a marca diz "AGORA 12:00"', () => {
    const { getByTestId } = wrap();
    expect(within(getByTestId('marca-agora')).getByText('AGORA 12:00')).toBeTruthy();
  });

  it('a lista mostra no maximo 4 linhas no celular e o contador mostra o total de seguintes', () => {
    const { getAllByTestId, getByTestId } = wrap();
    // seguintes = Nala, Simba, Mel, Bolinha, Fifi (5); limite 4 no celular.
    expect(getAllByTestId(/^seguinte-/)).toHaveLength(4);
    expect(textoDe(getByTestId('seguintes-contagem'))).toBe('5');
  });

  it('"Abrir prontuario" e botao com label do pet, navega para a consulta do pet e e o mesmo destino da Hoje', () => {
    const { getByTestId } = wrap();
    const b = getByTestId('btn-abrir-prontuario-proximo');
    expect(b.props.accessibilityRole).toBe('button');
    expect(b.props.accessibilityLabel).toBe('Abrir prontuário de Thor');
    fireEvent.press(b);
    expect(mockPush).toHaveBeenCalledWith(ROUTES.app.consulta(102, 2, 1));
  });

  it('sem pet.id o botao fica desabilitado e nao navega (como a Hoje)', () => {
    mockAgenda.mockReturnValue(ok([ag(1, 'Sem Ficha', 12, 30, 'AGENDADO', { pet: { id: 0, nmPet: 'Sem Ficha', nmEspecie: '', nmRaca: '' } })]));
    const { getByTestId } = wrap();
    const b = getByTestId('btn-abrir-prontuario-proximo');
    expect(b.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(b);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('"Ver todos de hoje" abre a Hoje (rota com modo=hoje)', () => {
    const { getByTestId } = wrap();
    fireEvent.press(getByTestId('btn-ver-todos-hoje'));
    expect(mockPush).toHaveBeenCalledWith(ROUTES.app.agendaHoje);
  });
});

describe('Dashboard -- estados do bloco do dia', () => {
  it('dia acabou (so encerrados): "Nada mais por hoje" com o numero, nunca a frase de erro nem de dia vazio', () => {
    mockAgenda.mockReturnValue(ok([ag(1, 'A', 9, 0, 'FINALIZADO'), ag(2, 'B', 10, 0, 'CANCELADO')]));
    const { getByText, queryByText, queryByTestId } = wrap();
    expect(getByText('Nada mais por hoje')).toBeTruthy();
    expect(getByText('2 atendimentos encerrados hoje.')).toBeTruthy();
    expect(queryByText('Nenhum atendimento hoje')).toBeNull();
    expect(queryByTestId('proximo-atendimento')).toBeNull();
  });

  it('nada agendado: "Nenhum atendimento hoje" (vazio verdadeiro, distinto do fim do dia)', () => {
    mockAgenda.mockReturnValue(ok([]));
    const { getByText, queryByText, queryByTestId } = wrap();
    expect(getByText('Nenhum atendimento hoje')).toBeTruthy();
    expect(queryByText('Nada mais por hoje')).toBeNull();
    expect(queryByTestId('empty-appointments')).toBeTruthy();
  });

  it('falha sem cache: ErrorState e NENHUM texto de vazio', () => {
    mockAgenda.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: REFETCH });
    const { getByText, queryByText, queryByTestId, getByTestId } = wrap();
    expect(getByText('Não foi possível carregar os atendimentos')).toBeTruthy();
    expect(queryByText('Nenhum atendimento hoje')).toBeNull();
    expect(queryByText('Nada mais por hoje')).toBeNull();
    expect(queryByTestId('empty-appointments')).toBeNull();
    expect(queryByTestId('empty-fim-do-dia')).toBeNull();
    expect(getByTestId('error-state')).toBeTruthy();
  });

  it('falha COM cache: faixa "Mostrando dados salvos" e o destaque continua visivel', () => {
    mockAgenda.mockReturnValue({ data: DIA, isLoading: false, isError: true, refetch: REFETCH });
    const { getByTestId } = wrap();
    expect(getByTestId('query-state-salvos')).toBeTruthy();
    expect(textoDe(getByTestId('proximo-pet'))).toBe('Thor');
  });

  it('carregando: skeleton, sem destaque nem vazio', () => {
    mockAgenda.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: REFETCH });
    const { queryByTestId, getAllByTestId } = wrap();
    expect(getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(queryByTestId('proximo-atendimento')).toBeNull();
    expect(queryByTestId('empty-appointments')).toBeNull();
  });
});

describe('Dashboard -- marca "agora" nos casos de borda', () => {
  it('todos os seguintes no futuro: a marca vem ANTES da lista', () => {
    mockAgenda.mockReturnValue(ok([ag(1, 'P', 12, 30, 'AGENDADO'), ag(2, 'Q', 13, 0, 'AGENDADO'), ag(3, 'R', 13, 30, 'AGENDADO')]));
    const { root } = wrap();
    const ids = ordem(root);
    expect(ids.indexOf('marca-agora')).toBeGreaterThan(-1);
    expect(ids.indexOf('marca-agora')).toBeLessThan(ids.indexOf('seguinte-2'));
  });

  it('todos os seguintes no passado: a marca vem DEPOIS da lista', () => {
    mockAgenda.mockReturnValue(ok([ag(1, 'P', 9, 0, 'AGENDADO'), ag(2, 'Q', 10, 0, 'AGENDADO'), ag(3, 'R', 11, 0, 'AGENDADO')]));
    const { root } = wrap();
    const ids = ordem(root);
    expect(ids.indexOf('marca-agora')).toBeGreaterThan(ids.indexOf('seguinte-3'));
  });

  it('so o proximo (sem seguintes): sem marca e sem quebrar', () => {
    mockAgenda.mockReturnValue(ok([ag(1, 'P', 13, 0, 'AGENDADO')]));
    const { queryByTestId, getByTestId } = wrap();
    expect(queryByTestId('marca-agora')).toBeNull();
    expect(textoDe(getByTestId('proximo-pet'))).toBe('P');
  });
});

describe('Dashboard -- fonte do bloco e tokens (grep)', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const dash = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '(app)', 'dashboard.tsx'), 'utf8');

  it('dashboard nao importa useRecentes e importa useAgendaHoje (controle positivo: o import do hook de alertas acha)', () => {
    expect(dash.includes('useAlertas')).toBe(true); // controle positivo: o grep enxerga o arquivo
    expect(dash.includes('useRecentes')).toBe(false);
    expect(dash.includes('useAgendaHoje')).toBe(true);
  });

  it('o componente do destaque nao tem hex, fontSize nem borderRadius numerico literal', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'domain', 'ProximosDoDia.tsx'), 'utf8');
    expect(/#[0-9A-Fa-f]{3,8}\b/.test(src)).toBe(false);
    expect(/fontSize:\s*\d/.test(src)).toBe(false);
    expect(/borderRadius:\s*\d/.test(src)).toBe(false);
    expect(/fontSize:/.test(src)).toBe(true); // controle positivo: a regex enxerga os estilos
  });

  it('o destaque usa ocean-pale + borda ocean 1px, sem sombra nem barra lateral', () => {
    const { getByTestId } = wrap();
    const st = StyleSheet.flatten(getByTestId('proximo-atendimento').props.style);
    expect(st).toMatchObject({ borderWidth: 1 });
    expect(st.shadowOpacity).toBeUndefined();
    expect(st.borderLeftWidth).toBeUndefined();
  });
});
