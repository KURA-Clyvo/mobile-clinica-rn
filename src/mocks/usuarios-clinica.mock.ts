import type { InternalAxiosRequestConfig } from 'axios';
import type {
  UsuarioClinicaResponse,
  UsuarioClinicaCreateRequest,
  UsuarioClinicaUpdateRequest,
  UsuarioClinicaSenhaUpdateRequest,
} from '../types/api';

// FM-02 — fixture do UsuariosClinicaController (7 rotas, ver brief). Shape
// CRU do backend (UsuarioClinicaResponseDto), sem tradução — mesmo padrão de
// pets.mock.ts. Regra do repo (TASK-65/FIX_5): imitar o CONTRATO do backend,
// não o shape que a UI produz.
//
// STATEFUL, mesmo padrão de agenda.mock.ts::getStore() (lição da FM-04): um
// PATCH/PUT/POST/DELETE que não persiste "reverte na tela" no próximo
// refetch, na frente de quem está vendo a demo. `_store` é módulo-level,
// preenchido uma vez (lazy), e todas as 4 rotas de escrita mutam o MESMO
// array que a leitura consulta.
function buildUsuarios(): UsuarioClinicaResponse[] {
  const now = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return [
    // Gestor com ficha — o caso que TODO login de demonstração produz
    // (AuthService.RegisterClinicaAsync sempre cria o gestor COM vínculo,
    // ver useIsGestor.ts). idVeterinario:1 casa com veterinarios.mock.ts.
    {
      id: 1,
      idClinica: 1,
      idVeterinario: 1,
      dsEmail: 'felipe.ferrete@kura.vet',
      tpPerfil: 'GESTOR',
      stAtiva: true,
      dtCriacao: now,
      dtAtualizacao: null,
    },
    // Veterinário com ficha (idVeterinario:2 casa com veterinarios.mock.ts) —
    // caso comum, NÃO é a mordida obrigatória (esse é criado pela própria
    // tela em runtime, sem idVeterinario).
    {
      id: 2,
      idClinica: 1,
      idVeterinario: 2,
      dsEmail: 'camila.rocha@kura.vet',
      tpPerfil: 'VETERINARIO',
      stAtiva: true,
      dtCriacao: now,
      dtAtualizacao: null,
    },
  ];
}

let _store: UsuarioClinicaResponse[] | null = null;

function getStore(): UsuarioClinicaResponse[] {
  if (!_store) {
    _store = buildUsuarios();
  }
  return _store;
}

// Exportado só para teste — mesmo motivo de agenda.mock.ts::__resetStoreParaTeste:
// o registro de módulos do Jest é por ARQUIVO, não por `it()`.
export function __resetStoreParaTeste(): void {
  _store = null;
}

// Mesma armadilha documentada em agenda.mock.ts::atualizarStatus: `config.data`
// chega como objeto já (não string JSON) pela cadeia real
// (apiClient -> interceptor de mock -> resolveMock), mas aceita os dois
// formatos por segurança.
function parseBody<T>(config: InternalAxiosRequestConfig): T {
  return (typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})) as T;
}

function extractId(url: string | undefined, suffix = ''): number {
  const pattern = new RegExp(`/usuarios-clinica/(\\d+)${suffix}$`);
  const match = url?.match(pattern);
  return match ? Number(match[1]) : 0;
}

function emailEmUsoPorOutroAtivo(email: string, excetoId: number): boolean {
  const alvo = email.trim().toLowerCase();
  return getStore().some(
    (u) => u.id !== excetoId && u.stAtiva && u.dsEmail.trim().toLowerCase() === alvo,
  );
}

function ficariaSemGestorAtivo(excetoId: number): boolean {
  return !getStore().some((u) => u.id !== excetoId && u.stAtiva && u.tpPerfil === 'GESTOR');
}

function rejeitar(status: number, code: string, message: string): Promise<never> {
  return Promise.reject({ status, code, message });
}

// GET (lista) | POST (criar) — ambos batem em /api/v1/usuarios-clinica.
export async function colecao(
  config: InternalAxiosRequestConfig,
): Promise<UsuarioClinicaResponse[] | UsuarioClinicaResponse> {
  const method = config.method?.toUpperCase() ?? 'GET';
  const store = getStore();

  if (method === 'POST') {
    const body = parseBody<UsuarioClinicaCreateRequest>(config);

    if (emailEmUsoPorOutroAtivo(body.dsEmail, -1)) {
      return rejeitar(422, 'EMAIL_EM_USO', 'Este e-mail já está em uso nesta clínica.');
    }

    const novo: UsuarioClinicaResponse = {
      id: Math.max(0, ...store.map((u) => u.id)) + 1,
      idClinica: 1,
      idVeterinario: body.idVeterinario ?? null,
      dsEmail: body.dsEmail,
      tpPerfil: body.tpPerfil,
      stAtiva: true,
      dtCriacao: new Date().toISOString(),
      dtAtualizacao: null,
    };
    store.push(novo);
    return novo;
  }

  return [...store];
}

// GET (detalhe) | PUT (atualizar) | DELETE (desativar) — todos batem em
// /api/v1/usuarios-clinica/{id}. Despacho por config.method, mesmo padrão de
// teleconsultaMock.sala.
export async function byId(
  config: InternalAxiosRequestConfig,
): Promise<UsuarioClinicaResponse | undefined> {
  const method = config.method?.toUpperCase() ?? 'GET';
  const id = extractId(config.url);
  const item = getStore().find((u) => u.id === id);

  if (!item) {
    return rejeitar(404, 'NOT_FOUND', `Usuário ${id} não encontrado`);
  }

  if (method === 'GET') {
    return item;
  }

  if (method === 'PUT') {
    const body = parseBody<UsuarioClinicaUpdateRequest>(config);

    if (emailEmUsoPorOutroAtivo(body.dsEmail, item.id)) {
      return rejeitar(422, 'EMAIL_EM_USO', 'Este e-mail já está em uso nesta clínica.');
    }
    // A regra real (UsuariosClinicaService) reprova qualquer PUT que
    // rebaixe o ÚLTIMO gestor ativo — inclusive um GESTOR editando o
    // próprio papel, não só um GESTOR editando outro.
    if (item.tpPerfil === 'GESTOR' && body.tpPerfil !== 'GESTOR' && ficariaSemGestorAtivo(item.id)) {
      return rejeitar(422, 'SEM_GESTOR_ATIVO', 'A clínica ficaria sem nenhum gestor ativo.');
    }

    item.dsEmail = body.dsEmail;
    item.tpPerfil = body.tpPerfil;
    item.idVeterinario = body.idVeterinario ?? null;
    item.dtAtualizacao = new Date().toISOString();
    return item;
  }

  // DELETE — desativação (soft delete), NUNCA exclusão física.
  if (item.tpPerfil === 'GESTOR' && item.stAtiva && ficariaSemGestorAtivo(item.id)) {
    return rejeitar(422, 'SEM_GESTOR_ATIVO', 'A clínica ficaria sem nenhum gestor ativo.');
  }
  item.stAtiva = false;
  item.dtAtualizacao = new Date().toISOString();
  return undefined; // 204, sem corpo
}

// PUT /api/v1/usuarios-clinica/{id}/senha — 204, sem corpo.
export async function senha(config: InternalAxiosRequestConfig): Promise<undefined> {
  const id = extractId(config.url, '/senha');
  const item = getStore().find((u) => u.id === id);
  if (!item) {
    return rejeitar(404, 'NOT_FOUND', `Usuário ${id} não encontrado`);
  }
  const body = parseBody<UsuarioClinicaSenhaUpdateRequest>(config);
  if (!body.dsSenha || body.dsSenha.length < 6) {
    return rejeitar(400, 'SENHA_INVALIDA', 'A senha precisa ter pelo menos 6 caracteres.');
  }
  return undefined;
}

// POST /api/v1/usuarios-clinica/{id}/reativacao — idempotente: reativar
// já-ativo também devolve 200 (sem erro), igual ao real.
export async function reativacao(
  config: InternalAxiosRequestConfig,
): Promise<UsuarioClinicaResponse> {
  const id = extractId(config.url, '/reativacao');
  const item = getStore().find((u) => u.id === id);
  if (!item) {
    return rejeitar(404, 'NOT_FOUND', `Usuário ${id} não encontrado`);
  }
  if (item.stAtiva) {
    return item; // idempotente
  }
  if (emailEmUsoPorOutroAtivo(item.dsEmail, item.id)) {
    return rejeitar(422, 'EMAIL_EM_USO', 'O e-mail deste usuário já está em uso por outro usuário ativo desta clínica.');
  }
  item.stAtiva = true;
  item.dtAtualizacao = new Date().toISOString();
  return item;
}
