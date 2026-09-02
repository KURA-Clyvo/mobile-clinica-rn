import React from 'react';
import { Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { useAuthStore } from '../src/store/authStore';
import { useIsGestor, useRequireGestor } from '../src/hooks/useIsGestor';
import { ROUTES } from '../src/constants/routes';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const VET = {
  id: 1,
  nmVeterinario: 'Dr. Silva',
  nrCRMV: '12345-SP',
  dsEmail: 'dr@clinic.com',
};

function sessao(over: Record<string, unknown> = {}) {
  return {
    token: 'token-abc',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'dr@clinic.com',
    tpPerfil: 'VETERINARIO' as const,
    usuario: VET,
    ...over,
  };
}

function semSessao() {
  return {
    token: null,
    expiresAt: null,
    email: null,
    tpPerfil: null,
    usuario: null,
  };
}

// ─── Probes ──────────────────────────────────────────────────────────────
//
// Componentes mínimos para montar cada hook — mesmo papel que `useDashboard.
// test.ts` cumpre com `renderHook`, mas via `render` porque `useRequireGestor`
// precisa da árvore de verdade para provar o "sem flash" (um `result.current`
// de `renderHook` não passa por reconciliação real, e o que se quer provar é
// justamente que o CONTEÚDO não chega a existir na árvore).
function ProbeIsGestor() {
  const isGestor = useIsGestor();
  return <Text testID="probe-is-gestor">{isGestor ? 'sim' : 'nao'}</Text>;
}

function ProbeRequireGestor() {
  const podeVer = useRequireGestor();
  // Mesma forma do guard de `consulta/[idPet].tsx`/`receituario/[idPet].tsx`
  // (FM-01): o `return null` fica DEPOIS de todos os hooks (aqui só há um),
  // nunca antes — regra dos hooks.
  if (!podeVer) return null;
  return <Text testID="conteudo-protegido">conteudo</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState(semSessao());
});

// ─── FM-03 — a matriz de 3 casos que a task exige além da mordida do backlog:
// as duas perguntas ("tenho ficha?" x "meu papel deixa ver?") são
// INDEPENDENTES, e só uma matriz de 3 (não 2) prova isso — 2 casos bastariam
// para um helper que colapsasse as duas perguntas em `usuario !== null`
// parecer certo.
describe('useIsGestor — matriz de 3 casos', () => {
  it('veterinário puro (com ficha): não vê conteúdo de gestor', () => {
    useAuthStore.setState(sessao({ tpPerfil: 'VETERINARIO', usuario: VET }));
    const { getByTestId } = render(<ProbeIsGestor />);
    expect(getByTestId('probe-is-gestor').props.children).toBe('nao');
  });

  it('gestor COM ficha (o único caso que ocorre subindo o app, AuthService.RegisterClinicaAsync:296-308): vê', () => {
    useAuthStore.setState(sessao({ tpPerfil: 'GESTOR', usuario: VET }));
    const { getByTestId } = render(<ProbeIsGestor />);
    expect(getByTestId('probe-is-gestor').props.children).toBe('sim');
  });

  it('gestor SEM ficha: vê igual ao gestor com ficha — a pergunta de papel não depende de ficha', () => {
    useAuthStore.setState(sessao({ tpPerfil: 'GESTOR', usuario: null }));
    const { getByTestId } = render(<ProbeIsGestor />);
    expect(getByTestId('probe-is-gestor').props.children).toBe('sim');
  });

  // Controle negativo: sem sessão nenhuma, nada renderiza como "gestor". Sem
  // isto, os 2 casos GESTOR acima seriam compatíveis com "sempre vê" — nunca
  // provariam que o gate depende de fato de `tpPerfil`.
  it('CONTROLE — sem sessão: não vê', () => {
    useAuthStore.setState(semSessao());
    const { getByTestId } = render(<ProbeIsGestor />);
    expect(getByTestId('probe-is-gestor').props.children).toBe('nao');
  });
});

// ─── useRequireGestor — guarda de TELA inteira, herdada da técnica da FM-01
// (`consulta`/`receituario`): redirect + guarda de RENDER, para não piscar o
// conteúdo antes do `useEffect` disparar.
describe('useRequireGestor — redirect e não-flash', () => {
  it('NÃO-gestor (VETERINARIO): redireciona para o dashboard', () => {
    useAuthStore.setState(sessao({ tpPerfil: 'VETERINARIO', usuario: VET }));
    render(<ProbeRequireGestor />);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(ROUTES.app.dashboard);
  });

  // A metade que só a guarda de RENDER resolve: não basta redirecionar, o
  // conteúdo não pode chegar a existir na árvore no caminho.
  it('NÃO-gestor: o conteúdo protegido não chega a renderizar (sem flash)', () => {
    useAuthStore.setState(sessao({ tpPerfil: 'VETERINARIO', usuario: VET }));
    const { queryByTestId } = render(<ProbeRequireGestor />);
    expect(queryByTestId('conteudo-protegido')).toBeNull();
  });

  // Herda a lição da G2 da FM-01: `router` não promete identidade estável
  // entre renders (o mock acima devolve um objeto NOVO a cada chamada, de
  // propósito — é a forma real do `useRouter()`), e SEM o `useRef` isso
  // chama `router.replace` mais de uma vez a cada novo ciclo de render, não
  // só no primeiro. `rerender` força exatamente esse segundo ciclo (mesmo
  // `isGestor`, `router` com identidade nova) — é o cenário em que a G2 da
  // FM-01 mediu a chamada dupla em `consulta/[idPet].tsx`.
  it('NÃO-gestor: redireciona exatamente 1 vez, mesmo com um segundo ciclo de render', () => {
    useAuthStore.setState(sessao({ tpPerfil: 'VETERINARIO', usuario: VET }));
    const { rerender } = render(<ProbeRequireGestor />);
    expect(mockReplace).toHaveBeenCalledTimes(1);

    act(() => {
      rerender(<ProbeRequireGestor />);
    });

    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  // Controle positivo: COM papel de gestor, nada disso acontece — sem este
  // caso, os três testes acima seriam compatíveis com "a guarda SEMPRE
  // redireciona e NUNCA renderiza", não com "só quando não é gestor".
  it('CONTROLE — GESTOR: renderiza o conteúdo e NÃO redireciona', () => {
    useAuthStore.setState(sessao({ tpPerfil: 'GESTOR', usuario: null }));
    const { getByTestId } = render(<ProbeRequireGestor />);
    expect(getByTestId('conteudo-protegido')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
