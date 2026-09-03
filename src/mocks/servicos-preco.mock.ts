import type { InternalAxiosRequestConfig } from 'axios';
import type {
  ServicoPrecoResponse,
  ServicoPrecoCreateRequest,
  ServicoPrecoUpdateRequest,
} from '../types/api';

// FM-05 — fixture do ServicosPrecoController (6 rotas, ver brief). Shape CRU
// do backend (ServicoPrecoResponseDto), sem tradução — mesmo padrão de
// usuarios-clinica.mock.ts. Regra do repo (TASK-65/FIX_5): imitar o
// CONTRATO do backend, não o shape que a UI produz.
//
// STATEFUL, mesmo padrão de usuarios-clinica.mock.ts::getStore() (lição da
// FM-04): um PUT/POST/DELETE que não persiste "reverte na tela" no próximo
// refetch, na frente de quem está vendo a demo. `_store` é módulo-level,
// preenchido uma vez (lazy), e todas as rotas de escrita mutam o MESMO
// array que a leitura consulta.
//
// O seed nasce com pelo menos 1 item INATIVO (id 3) de propósito: sem isso
// o toggle "Mostrar desativados" da tela não teria o que mostrar na demo, e
// ninguém conseguiria ver o comportamento rodando (brief §3.4).
function buildServicos(): ServicoPrecoResponse[] {
  const criadoHaUmMes = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const desativadoOntem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 1,
      idClinica: 1,
      nmServico: 'Consulta de rotina',
      vlPreco: 150.0,
      stAtiva: true,
      dtCriacao: criadoHaUmMes,
      dtAtualizacao: null,
    },
    {
      id: 2,
      idClinica: 1,
      nmServico: 'Vacina V10',
      vlPreco: 90.5,
      stAtiva: true,
      dtCriacao: criadoHaUmMes,
      dtAtualizacao: null,
    },
    // Item INATIVO -- sem ele o toggle "Mostrar desativados" não tem o que
    // exibir na demonstração (ver comentário do cabeçalho).
    {
      id: 3,
      idClinica: 1,
      nmServico: 'Banho e tosa (descontinuado)',
      vlPreco: 60.0,
      stAtiva: false,
      dtCriacao: criadoHaUmMes,
      dtAtualizacao: desativadoOntem,
    },
  ];
}

let _store: ServicoPrecoResponse[] | null = null;

function getStore(): ServicoPrecoResponse[] {
  if (!_store) {
    _store = buildServicos();
  }
  return _store;
}

// Exportado só para teste — mesmo motivo de usuarios-clinica.mock.ts::
// __resetStoreParaTeste: o registro de módulos do Jest é por ARQUIVO, não
// por `it()`.
export function __resetStoreParaTeste(): void {
  _store = null;
}

// Mesma armadilha documentada em agenda.mock.ts::atualizarStatus /
// usuarios-clinica.mock.ts::parseBody: `config.data` chega como objeto já
// (não string JSON) pela cadeia real, mas aceita os dois formatos por
// segurança.
function parseBody<T>(config: InternalAxiosRequestConfig): T {
  return (typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})) as T;
}

function extractId(url: string | undefined, suffix = ''): number {
  const pattern = new RegExp(`/servicos-preco/(\\d+)${suffix}$`);
  const match = url?.match(pattern);
  return match ? Number(match[1]) : 0;
}

// Brief §3.2/§3.7 — o binder do backend é `bool` NÃO anulável (aceita só
// `true`/`false`), e o service (servicos-preco.service.ts) OMITE `params`
// inteiro quando `incluirInativos` é `false` (decisão declarada: mais perto
// do default real do backend). Este helper trata AUSÊNCIA de
// `config.params` e `incluirInativos: false` explícito como EQUIVALENTES —
// os dois significam "só ativos". Nunca lê a URL: o axios NÃO concatena
// `params` em `config.url` (armadilha documentada no cabeçalho de
// mock-adapter.ts).
function lerIncluirInativos(config: InternalAxiosRequestConfig): boolean {
  return config.params?.incluirInativos === true;
}

function rejeitar(status: number, code: string, message: string): Promise<never> {
  return Promise.reject({ status, code, message });
}

// ─── ANCORAGEM DAS REGRAS COPIADAS DO BACKEND ─────────────────────────────
//
// Este mock replica invariantes de negócio que moram em OUTRO REPOSITÓRIO.
// Cópia cross-repo sem âncora é cópia que já divergiu — só não se sabe quando
// (regra de ouro v7 deste projeto). Formato herdado de usuarios-clinica.mock.ts.
//
// FONTE:   backend-clinica-dotnet
// COMMIT:  94f558d  (`main`)
// CONFERIDO EM: 2026-09-03 (implementador da FM-05)
// REPRODUZIR:
//     git show 94f558d:src/Kura.Application/Services/ServicoPrecoService.cs \
//       | sed -n '57,68p;92,136p;139,190p;201,215p'
//     git show 94f558d:src/Kura.Infrastructure/Persistence/Repositories/ServicoPrecoRepository.cs \
//       | sed -n '24,52p'
//
// As regras replicadas, com a linha de cada uma (ServicoPrecoService.cs
// salvo indicação em contrário):
//   :187-190  GarantirServicoAtivo        -> 422 em serviço desativado.
//             Chamado por AtualizarAsync (:122, ANTES de qualquer outra
//             validação do PUT) — GET, DELETE e reativação NÃO chamam.
//   :97,:127  GarantirNomeDisponivelAsync -> 422 em nome já usado por outro
//             serviço ATIVO da clínica, na CRIAÇÃO e no UPDATE (com
//             excetoId). Comparação case-insensitive sobre o nome APARADO
//             (ServicoPrecoRepository.cs:37-52 — `ToUpper()` em :44 e em
//             :50, os DOIS lados) — só conta entre ATIVOS
//             (Repository.cs:49 `&& s.StAtiva`); um INATIVO com o mesmo
//             nome NÃO bloqueia recadastro (FD-07 não criou UNIQUE de
//             propósito).
//             ⚠️ Os 3 ponteiros acima foram CORRIGIDOS na fix wave da FM-05
//             (G2, achado A-2): diziam `:37-45` e `:43`, e **`:43` é linha
//             de COMENTÁRIO** — o predicado `&& s.StAtiva` está em :49 e o
//             segundo `ToUpper()` em :50, FORA do intervalo citado. O
//             comando REPRODUZIR acima (`sed -n '24,52p'`) sempre cobriu as
//             linhas certas, então quem o rodasse veria o código correto;
//             o que apontava torto era o ponteiro inline. Registrado porque
//             **âncora que aponta torto é pior que âncora ausente — ela
//             PARECE conferida.**
//   :160-176  ReativarAsync               -> 422 REATIVACAO_NOME_OCUPADO se
//             o nome já pertence a outro serviço ATIVO (enquanto estava
//             desativado, o nome pode ter sido recadastrado).
//   :164-167  ReativarAsync (idempotente) -> reativar o que já está ativo
//             devolve o estado atual, 200 SEM ERRO.
//   :139-149  DesativarAsync              -> early-return SILENCIOSO se já
//             inativo (não é erro, "204" de novo).
//   :211      NormalizarNome = nome.Trim() -> o servidor APARA o nome.
//   Repository.cs:24-30  ListarDaClinicaAsync -> `(incluirInativos ||
//             s.StAtiva)` — SEM incluirInativos=true a lista NUNCA traz
//             inativo — e `.OrderBy(s => s.NmServico)`: a lista vem
//             ORDENADA POR NOME.
//             ⚠️ A ordenação daqui é APROXIMADA DE PROPÓSITO (G2, achado
//             A-3): este mock usa `localeCompare(…, 'pt-BR')`, e o backend
//             ordena pela COLLATION DO ORACLE (binária por padrão). Elas
//             DIVERGEM para nome acentuado ou iniciando em minúscula —
//             "Ácido…" vem primeiro em pt-BR e por ÚLTIMO em ordem binária.
//             Escolhido pt-BR porque é a ordem certa para quem lê a tela;
//             fica declarado que é uma forma que o backend real não produz
//             exatamente. 🔴 NÃO É MEDIÇÃO CONTRA ORACLE — é inferência
//             sobre a collation default; nenhum teste deste repo toca
//             Oracle real. Mesma ressalva vale para
//             usuarios-clinica.mock.ts (`dsEmail`), onde o risco é menor
//             porque e-mail é ASCII minúsculo.
//   Repository.cs:32-35  BuscarPorIdNaClinicaAsync -> NÃO filtra StAtiva —
//             GET /{id} devolve o serviço mesmo DESATIVADO (só a LISTA
//             filtra).
//
// 🔴 O QUE ESTE MOCK DELIBERADAMENTE **NÃO** REPLICA (G2, achado A-4):
// as regras de **400** do `ServicoPrecoCreateValidator`/`UpdateValidator`
// @ 94f558d — nome vazio, nome > 200 chars, preço negativo, preço acima de
// 99.999.999,99 e mais de 2 casas decimais. `POST`/`PUT` daqui aceitam
// qualquer corpo. **Isto é seguro hoje porque o `ServicoPrecoFormModal`
// replica as 3 regras client-side** (`zod`, `PRECO_MAXIMO`,
// `contarCasasDecimais`), então nenhum caminho de USUÁRIO alcança o mock
// com corpo inválido. ⚠️ Mas `criarServicoPreco()`/`atualizarServicoPreco()`
// chamados DIRETO (teste, ou tela futura sem o modal) têm SUCESSO aqui
// onde o backend real devolveria `400`. É a direção **visível** da
// divergência (backend mais restritivo), não a silenciosa — declarado em
// vez de replicado para não duplicar a validação em 3 lugares.
//
// ⚠️ As mensagens abaixo são PARÁFRASES curtas do brief, não os literais do
// backend — quem for casar texto exato numa asserção, casar contra o
// backend, não contra este arquivo.
//
// 🔴 AS DUAS DIREÇÕES DE DIVERGÊNCIA NÃO SÃO SIMÉTRICAS (mesma lição da
// FM-02/FM-04):
//   backend fica MAIS restritivo  -> o mock aceita, o real recusa: a demo
//        promete uma ação que o backend nega. Falha VISÍVEL, mas só fora
//        da demo (foi o caso de GarantirUsuarioAtivo na FM-02).
//   backend fica MENOS restritivo -> o mock recusa uma operação que o real
//        permite: a ação some da demo sem erro nenhum. 🔴 É a difícil de
//        notar.
//   🆕 TERCEIRA DIREÇÃO, achada nesta task (§2 do brief): backend
//        recorta a LISTA de propósito (só ativos por padrão) e o mock da
//        FM-02 devolvia a store INTEIRA — não é "regra de negócio
//        recusada/aceita errada", é "o mock mostra dado que o backend real
//        NUNCA devolveria naquela chamada". A UI construída em cima disso
//        (chip "Inativo"/botão "Reativar" na lista sem toggle) fica sendo
//        UI para um estado inalcançável contra o backend real — sem erro
//        nenhum, porque não é uma regra de negócio que falha, é uma forma
//        que a resposta nunca assume. Corrigido aqui E em
//        usuarios-clinica.mock.ts (mesma classe, mesmo ciclo — ver
//        ancoragem daquele arquivo).
function garantirServicoAtivo(item: ServicoPrecoResponse): Promise<never> | null {
  if (item.stAtiva) return null;
  return rejeitar(
    422,
    'SERVICO_DESATIVADO',
    'Este serviço está DESATIVADO e alterações não têm efeito enquanto ele estiver assim. ' +
      'Reative-o primeiro (operação de reativação deste mesmo recurso) e refaça a alteração.',
  );
}

function normalizarNome(nome: string): string {
  return nome.trim();
}

function nomeEmUsoPorOutroAtivo(nome: string, excetoId: number): boolean {
  const alvo = normalizarNome(nome).toUpperCase();
  return getStore().some(
    (s) => s.id !== excetoId && s.stAtiva && s.nmServico.trim().toUpperCase() === alvo,
  );
}

// GET (lista) | POST (criar) — ambos batem em /api/v1/servicos-preco.
export async function colecao(
  config: InternalAxiosRequestConfig,
): Promise<ServicoPrecoResponse[] | ServicoPrecoResponse> {
  const method = config.method?.toUpperCase() ?? 'GET';

  if (method === 'POST') {
    const body = parseBody<ServicoPrecoCreateRequest>(config);
    const nome = normalizarNome(body.nmServico);

    if (nomeEmUsoPorOutroAtivo(nome, -1)) {
      return rejeitar(
        422,
        'NOME_EM_USO',
        'Já existe um serviço ATIVO com este nome nesta clínica.',
      );
    }

    const store = getStore();
    const novo: ServicoPrecoResponse = {
      id: Math.max(0, ...store.map((s) => s.id)) + 1,
      idClinica: 1,
      nmServico: nome,
      vlPreco: body.vlPreco,
      stAtiva: true,
      dtCriacao: new Date().toISOString(),
      dtAtualizacao: null,
    };
    store.push(novo);
    return novo;
  }

  // GET — recorta por stAtiva salvo incluirInativos=true, e ORDENA por
  // nome (ServicoPrecoRepository.cs:24-30, ver ancoragem acima). Sem este
  // recorte, o mock devolveria a store inteira e a UI mostraria estado que
  // o backend real nunca produz nesta chamada (achado §2 do brief).
  const incluirInativos = lerIncluirInativos(config);
  return getStore()
    .filter((s) => incluirInativos || s.stAtiva)
    .slice()
    .sort((a, b) => a.nmServico.localeCompare(b.nmServico, 'pt-BR'));
}

// GET (detalhe) | PUT (atualizar) | DELETE (desativar) — todos batem em
// /api/v1/servicos-preco/{id}. Despacho por config.method, mesmo padrão de
// usuarios-clinica.mock.ts::byId.
export async function byId(
  config: InternalAxiosRequestConfig,
): Promise<ServicoPrecoResponse | undefined> {
  const method = config.method?.toUpperCase() ?? 'GET';
  const id = extractId(config.url);
  const item = getStore().find((s) => s.id === id);

  if (!item) {
    return rejeitar(404, 'NOT_FOUND', `Serviço ${id} não encontrado`);
  }

  if (method === 'GET') {
    // NÃO filtra por stAtiva -- GET /{id} devolve inativo também
    // (Repository.cs:32-35, ver ancoragem).
    return item;
  }

  if (method === 'PUT') {
    // ServicoPrecoService.cs:122 — GarantirServicoAtivo ANTES de qualquer
    // outra validação do PUT.
    const desativado = garantirServicoAtivo(item);
    if (desativado) return desativado;

    const body = parseBody<ServicoPrecoUpdateRequest>(config);
    const nome = normalizarNome(body.nmServico);

    if (!(nome.toUpperCase() === item.nmServico.trim().toUpperCase())) {
      if (nomeEmUsoPorOutroAtivo(nome, item.id)) {
        return rejeitar(
          422,
          'NOME_EM_USO',
          'Já existe um serviço ATIVO com este nome nesta clínica.',
        );
      }
    }

    item.nmServico = nome;
    item.vlPreco = body.vlPreco;
    item.dtAtualizacao = new Date().toISOString();
    return item;
  }

  // DELETE — desativação (soft delete). Early-return silencioso se já
  // inativo (ServicoPrecoService.cs:139-149) -- não é erro, 204 de novo.
  if (item.stAtiva) {
    item.stAtiva = false;
    item.dtAtualizacao = new Date().toISOString();
  }
  return undefined; // 204, sem corpo
}

// POST /api/v1/servicos-preco/{id}/reativacao — idempotente: reativar
// já-ativo também devolve 200 (sem erro), igual ao real.
export async function reativacao(
  config: InternalAxiosRequestConfig,
): Promise<ServicoPrecoResponse> {
  const id = extractId(config.url, '/reativacao');
  const item = getStore().find((s) => s.id === id);
  if (!item) {
    return rejeitar(404, 'NOT_FOUND', `Serviço ${id} não encontrado`);
  }
  if (item.stAtiva) {
    return item; // idempotente
  }
  if (nomeEmUsoPorOutroAtivo(item.nmServico, item.id)) {
    return rejeitar(
      422,
      'REATIVACAO_NOME_OCUPADO',
      'Não é possível reativar: já existe um serviço ATIVO com este nome nesta clínica.',
    );
  }
  item.stAtiva = true;
  item.dtAtualizacao = new Date().toISOString();
  return item;
}
