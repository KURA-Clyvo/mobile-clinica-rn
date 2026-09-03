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

// ─── ANCORAGEM DAS REGRAS COPIADAS DO BACKEND ─────────────────────────────
//
// Este mock replica invariantes de negócio que moram em OUTRO REPOSITÓRIO.
// Cópia cross-repo sem âncora é cópia que já divergiu — só não se sabe quando
// (regra de ouro v7 deste projeto). O precedente de como ancorar foi criado
// pela fix wave da FM-04, em `agenda.service.ts`: caminho + INTERVALO DE
// LINHAS + commit + o comando que reproduz a conferência.
//
// FONTE:   backend-clinica-dotnet
//          src/Kura.Application/Services/UsuarioClinicaService.cs
//          src/Kura.Infrastructure/Persistence/Repositories/UsuarioClinicaRepository.cs
// COMMIT:  94f558d  (`main`) -- atualizado nesta task (FM-05, brief §4); a
//          conferência ORIGINAL desta âncora foi feita em de96c70 (sessão
//          9); as linhas do SERVICE abaixo não mudaram entre os dois
//          commits (reconferido).
// CONFERIDO EM: 2026-09-03 (implementador da FM-05, ruling D-14 do Felipe:
//          "corrige a FM-05 e a FM-02 de uma vez")
// REPRODUZIR:
//     git show 94f558d:src/Kura.Application/Services/UsuarioClinicaService.cs \
//       | sed -n '64,88p;153p;163,186p;196,204p;288,292p'
//     git show 94f558d:src/Kura.Infrastructure/Persistence/Repositories/UsuarioClinicaRepository.cs \
//       | sed -n '60,90p'
//
// As regras replicadas, com a linha de cada uma:
//   :288-292  GarantirUsuarioAtivo   -> 422 em usuário desativado. Chamado por
//             AtualizarAsync (:153) e DefinirSenhaAsync (:198). ⚠️ NÃO é
//             chamado por DesativarAsync (que faz early-return silencioso,
//             :210-213) nem por ReativarAsync — replicado aqui igual.
//   :64-69    MensagemUltimoGestor   -> invariante do último gestor ativo,
//             disparado no PUT que REBAIXA um gestor (:171-172,:184-185) e no
//             DELETE de um gestor (:226-227).
//   :85-88    Mensagem do conflito de e-mail na REATIVAÇÃO.
//   🆕 Repository.cs:68-73  ListarDaClinicaAsync (FD-16) -> `(incluirInativos
//             || u.StAtiva)` DENTRO do `Where` — SEM `incluirInativos=true`
//             a lista NUNCA traz usuário inativo — e `.OrderBy(u =>
//             u.DsEmail)`: a lista vem ORDENADA POR E-MAIL. Achado e
//             corrigido na FM-05 (brief §4/§2): `colecao()` abaixo fazia
//             `return [...store]` (store INTEIRA, incluindo inativos, sem
//             ordenação) — ver a 3ª direção de divergência abaixo.
//             ⚠️ A ordenação daqui é APROXIMADA DE PROPÓSITO (G2 da FM-05,
//             achado A-3): usamos `localeCompare(…, 'pt-BR')` e o backend
//             ordena pela COLLATION DO ORACLE (binária por padrão). Para
//             `dsEmail` o risco é baixo — e-mail é ASCII minúsculo, onde as
//             duas ordens coincidem — mas fica declarado, e a ressalva vale
//             igualmente para `servicos-preco.mock.ts` (`nmServico`), onde
//             acento e maiúscula fazem as duas DIVERGIREM de fato.
//             🔴 NÃO É MEDIÇÃO CONTRA ORACLE: é inferência sobre a collation
//             default; nenhum teste deste repo toca Oracle real.
//
// ⚠️ As mensagens abaixo são PARÁFRASES curtas, não os literais do backend —
// o texto real é mais longo e instrui o próximo passo. Quem for casar texto
// exato numa asserção, casar contra o backend, não contra este arquivo.
//
// 🔴 AS DUAS DIREÇÕES DE DIVERGÊNCIA NÃO SÃO SIMÉTRICAS (mesma lição da FM-04):
//   backend fica MAIS restritivo  -> o mock aceita, o real recusa: a demo
//        promete uma ação que o backend nega. **Foi exatamente isto que
//        aconteceu com GarantirUsuarioAtivo** — a FM-02 não o replicou, a tela
//        oferecia "Editar"/"Trocar senha" em linha inativa, e só o modo real
//        recusaria. Falha VISÍVEL, mas só fora da demo.
//   backend fica MENOS restritivo -> o mock recusa uma operação que o real
//        permite: a ação some da demo sem erro nenhum. 🔴 É a difícil de notar.
//   🆕 TERCEIRA DIREÇÃO (achada na FM-05, brief §2): o backend RECORTA a
//        LISTA de propósito (só ativos por padrão) e este mock devolvia a
//        store INTEIRA — não é uma regra de negócio recusada/aceita errado,
//        é a resposta mostrando um estado que o backend real NUNCA produz
//        naquela chamada. Consequência real: a FM-02 shipou chip "Inativo"
//        e botão "Reativar" na lista SEM toggle nenhum -- UI para um estado
//        inalcançável contra o backend real, sem erro nenhum (a linha
//        inativa simplesmente nunca chegava no GET real). Corrigido aqui
//        (recorte + ordenação) e em `usuarios/index.tsx` (toggle "Mostrar
//        desativados", mesmo padrão da FM-05).
function garantirUsuarioAtivo(item: UsuarioClinicaResponse): Promise<never> | null {
  if (item.stAtiva) return null;
  return rejeitar(
    422,
    'USUARIO_DESATIVADO',
    'Este usuário está DESATIVADO e alterações não têm efeito enquanto ele estiver assim. ' +
      'Reative-o primeiro e refaça a alteração.',
  );
}

// FM-05 (brief §3.2/§4) — mesmo helper de servicos-preco.mock.ts::
// lerIncluirInativos: o service OMITE `params` inteiro quando `false`
// (decisão declarada em usuarios-clinica.service.ts); ausência de
// `config.params` e `incluirInativos: false` explícito são EQUIVALENTES.
// Nunca lê a URL (armadilha documentada no cabeçalho de mock-adapter.ts).
function lerIncluirInativos(config: InternalAxiosRequestConfig): boolean {
  return config.params?.incluirInativos === true;
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

  // FM-05 (brief §2/§4) — recorta por stAtiva salvo incluirInativos=true, e
  // ORDENA por e-mail (UsuarioClinicaRepository.cs:68-73, ver ancoragem no
  // topo do arquivo). Antes desta task, `[...store]` devolvia a store
  // INTEIRA, incluindo inativos — UI para um estado que o backend real
  // nunca produz nesta chamada.
  const incluirInativos = lerIncluirInativos(config);
  return store
    .filter((u) => incluirInativos || u.stAtiva)
    .slice()
    .sort((a, b) => a.dsEmail.localeCompare(b.dsEmail, 'pt-BR'));
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
    // UsuarioClinicaService.cs:153 — GarantirUsuarioAtivo ANTES de qualquer
    // outra validação do PUT (ver bloco de ancoragem acima).
    const desativado = garantirUsuarioAtivo(item);
    if (desativado) return desativado;

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
  // UsuarioClinicaService.cs:198 — DefinirSenhaAsync também exige usuário ATIVO.
  // A razão do backend, literal: "definir senha de usuário desativado é gravação
  // sem efeito observável — o login filtra ST_ATIVA, então a senha nova nunca
  // seria usada. 422 em vez de 204 mentiroso."
  const desativado = garantirUsuarioAtivo(item);
  if (desativado) return desativado;

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
