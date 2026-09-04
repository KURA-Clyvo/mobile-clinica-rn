export const STRINGS = {
  app: {
    name: 'KURA Clínica',
  },
  auth: {
    login: 'Entrar',
    email: 'E-mail',
    senha: 'Senha',
    esqueciSenha: 'Esqueci minha senha',
    emailPlaceholder: 'seu@email.com',
    senhaPlaceholder: 'Mínimo 6 caracteres',
    erroCredenciais: 'E-mail ou senha incorretos',
    erroRede: 'Sem conexão. Verifique sua internet.',
  },
  dashboard: {
    titulo: 'Dashboard',
    consultasHoje: 'Consultas hoje',
    pacientesAtendidos: 'Pacientes atendidos',
    alertasAtivos: 'Alertas ativos',
    teleorientacoes: 'Teleorientações',
    proximosAtendimentos: 'Próximos atendimentos',
    alertas: 'Alertas',
    semAlertas: 'Nenhum alerta ativo',
    // CQ-13: descrição instrutiva do estado vazio — o título continua
    // idêntico ao de antes (mordida preservada em DashboardScreen.test.tsx).
    semAlertasDesc: 'Alertas de vacina e de temperatura aparecem aqui assim que forem gerados.',
    semAtendimentos: 'Nenhum atendimento programado',
    semAtendimentosDesc: 'Quando um agendamento for confirmado, ele aparece aqui.',
    // FM-07 (ciclo FIN) — seção financeira, visível só para GESTOR (useIsGestor).
    // 🔴 `receitaBruta` é "Receita bruta", com essas palavras (ruling D-6) — "Receita" sozinho
    // é impreciso, e imprecisão financeira numa tela de gestor é erro fatal. O rótulo do KPI
    // não muda por causa do gap de captura abaixo; a honestidade sobre o gap vai no subtítulo.
    financeiro: 'Financeiro',
    // §3.4 do brief — GAP DE CAPTURA declarado: um atendimento que gera só receituário não
    // tem hoje onde lançar cobrança (achado M-5, G2 da FM-06); o card em consulta/[idPet].tsx
    // existe, receituario/[idPet].tsx não foi ligado. Decisão tomada: rotular honestamente em
    // vez de apresentar como "receita bruta da clínica" um número que só enxerga um dos
    // caminhos de atendimento.
    financeiroSubtitulo:
      'Receita das consultas lançadas — atendimentos fechados só no receituário ainda não têm onde lançar cobrança.',
    receitaBruta: 'Receita bruta',
    ticketMedio: 'Ticket médio',
    // §2.4 do brief — usar SEMPRE nrCobrancas === 0 para decidir este estado, NUNCA
    // receitaBruta === 0 (cobrança de cortesia com vlCobrado:0 também zera a receita e é
    // lançamento legítimo — ver cobrancas.mock.ts/FM-06).
    semFaturamento: 'Nenhuma cobrança registrada neste período',
    semFaturamentoDesc: 'Quando uma cobrança for lançada no atendimento, o resumo aparece aqui.',
    // 🔴 I-1 da G2 — "não sei" NÃO é "não houve". Antes desta fix wave, uma
    // falha de rede caía no mesmo ramo do estado vazio (`data` é `undefined`
    // nos dois casos) e o gestor lia "Nenhuma cobrança registrada" para um mês
    // que podia ter faturado.
    //
    // ⚠️ É a doutrina deste ciclo violada PELO CLIENTE: o backend se recusa a
    // devolver `0` para "não medimos" (`ticketMedio`/`variacaoPercentual` são
    // `null` de propósito, e o controller escreve "Zero para 'não medimos'
    // seria mentira") — e o app transformava a ausência de resposta em
    // afirmação sobre o negócio. Errar para "não faturou" num painel de gestor
    // é pior que não mostrar nada.
    erroFinanceiro: 'Não foi possível carregar o resumo financeiro',
    erroFinanceiroDesc: 'Verifique a conexão e puxe a tela para baixo para tentar de novo.',
    // FM-08 (ciclo FIN) — link do card financeiro do dashboard para o painel de gestão
    // (tela nova, `(app)/financeiro/index.tsx`).
    verPainelCompleto: 'Ver painel completo',
    // Sufixo usado junto de `formatarPercentual(variacaoPercentual)` -- ex.:
    // "+21,12% em relação ao período anterior". Fica em constante própria (em vez de string
    // única já pronta) porque o número formatado precisa entrar NO MEIO da frase.
    comparacaoPeriodoAnterior: 'em relação ao período anterior',
    // 🔴 `variacaoPercentual === null` só ocorre quando a receita do período anterior é ZERO
    // (contrato do backend, ResumoFinanceiroResponseDto.cs:106 -- "crescer do zero não tem
    // porcentagem"). NÃO é "0%" nem traço mudo -- é a frase honesta que o backend pede: "de
    // R$ 0,00 para R$ X". O valor de `receitaBrutaPeriodoAnterior` é lido do contrato (não
    // hardcoded em 0) e interpolado pelo componente junto com `receitaBruta`.
    semBaseComparacao: 'Sem base de comparação: o período anterior não teve receita',
  },
  // FM-08 (ciclo FIN) — tela nova `(app)/financeiro/index.tsx` (painel de gestão, GESTOR-only,
  // ruling D-16). Reusa deliberadamente `dashboard.financeiro`/`financeiroSubtitulo`/
  // `receitaBruta`/`ticketMedio`/`erroFinanceiro*`/`semFaturamento*`/`verPainelCompleto`/
  // `comparacaoPeriodoAnterior`/`semBaseComparacao` acima -- não duplica nenhuma dessas
  // strings (§4 item 5 do brief: "se o painel novo precisar do mesmo aviso, reuse a string,
  // não escreva uma segunda"). Este objeto só carrega o que É novo desta tela.
  financeiroPainel: {
    titulo: 'Painel de gestão',
    mixTitulo: 'Mix por serviço',
    // A soma das receitas dos baldes == receitaBruta, exato (invariante do backend) -- a
    // legenda diz isso para o gestor confiar na soma sem precisar somar ele mesmo.
    mixCaption: 'A soma dos itens abaixo fecha com a receita bruta do período.',
    // `idServicoPreco: null` -- balde de lançamento avulso (D-2), rótulo já vem do backend
    // (`nmServico`) como "(avulso)" -- este texto não é usado para rotular o balde em si,
    // só aparece se algum dia for preciso um rótulo de fallback.
    comparacaoTitulo: 'Comparação com o período anterior',
  },
  pacientes: {
    titulo: 'Pacientes',
    buscar: 'Buscar por nome ou tutor...',
    novo: '+ Novo',
    semResultados: 'Nenhum paciente encontrado',
    timeline: 'Histórico',
    vacinas: 'Vacinas',
    documentos: 'Documentos',
  },
  PACIENTES: {
    TITLE: 'Pacientes',
    SEARCH_PLACEHOLDER: 'Buscar pet ou tutor...',
    // CQ-13: os dois títulos abaixo continuam idênticos ao texto anterior —
    // PatientsListScreen.test.tsx confirma por `getByText` literal, os dois
    // casos são distintos de propósito (filtro sem match × nada cadastrado).
    EMPTY_SEARCH: 'Nenhum paciente encontrado',
    EMPTY_SEARCH_DESC: 'Tente buscar por outro nome de pet ou de tutor.',
    EMPTY_LIST: 'Nenhum paciente cadastrado',
    EMPTY_LIST_DESC: 'Pacientes cadastrados pela clínica aparecem aqui.',
    EMPTY_TIMELINE: 'Nenhum evento registrado',
    EMPTY_TIMELINE_DESC: 'Consultas, vacinas e exames aparecem aqui conforme forem registrados.',
    COUNT_SINGULAR: '1 paciente',
    COUNT_PLURAL: (n: number) => `${n} pacientes`,
    NO_TUTOR: 'Sem tutor',
  },
  acoes: {
    novaConsulta: 'Nova consulta',
    teleorientacao: 'Teleorientação',
    receituario: 'Receituário',
    salvar: 'Salvar',
    cancelar: 'Cancelar',
    voltar: 'Voltar',
    enviar: 'Enviar',
    confirmar: 'Confirmar',
  },
  luna: {
    titulo: 'Luna AI',
    online: 'Luna online',
    offline: 'Luna offline',
  },
  configuracoes: {
    titulo: 'Configurações',
    perfil: 'Perfil',
    preferencias: 'Preferências',
    time: 'Time',
    temaEscuro: 'Tema escuro',
    sair: 'Sair',
  },
  agenda: {
    titulo: 'Agenda',
    semanaAnterior: 'Semana anterior',
    proximaSemana: 'Próxima semana',
    // CQ-13: título idêntico ao anterior — AgendaScreen.test.tsx confirma
    // por `getByText('Nenhuma consulta neste dia')` literal.
    semConsultas: 'Nenhuma consulta neste dia',
    semConsultasDesc: 'Toque em outro dia da semana ou aguarde novos agendamentos.',
  },
  erros: {
    generico: 'Algo deu errado. Tente novamente.',
    semConexao: 'Sem conexão com a internet.',
    naoEncontrado: 'Registro não encontrado.',
  },
  AUTH: {
    INVALID_CREDENTIALS: 'E-mail ou senha incorretos',
    NETWORK_ERROR: 'Sem conexão. Verifique sua internet.',
  },
  VALIDATION: {
    EMAIL_INVALID: 'E-mail inválido',
    PASSWORD_MIN: 'A senha deve ter no mínimo 6 caracteres',
  },
  LUNA: {
    TITLE: 'Luna IA',
    STATUS_ONLINE: 'Online',
    STATUS_DEGRADADO: 'Degradado',
    STATUS_OFFLINE: 'Offline',
    RELATORIO_TITLE: 'Relatório de Triagens',
    PERIODO_7: '7 dias',
    PERIODO_30: '30 dias',
    PERIODO_90: '90 dias',
    TOTAL_TRIAGENS: (n: number) => `Total de triagens: ${n}`,
    ENCAMINHADAS: (n: number) => `Encaminhadas para vet: ${n}`,
    ALERTAS_TITLE: 'Alertas gerados pela Luna',
    // CQ-13: título idêntico ao anterior (reaproveita a mesma string de
    // `dashboard.semAlertas` no valor, não por import — os dois já tinham o
    // mesmo texto antes desta task).
    EMPTY_ALERTAS: 'Nenhum alerta ativo',
    EMPTY_ALERTAS_DESC:
      'Alertas gerados pela Luna aparecem aqui quando uma triagem precisar da atenção da clínica.',
  },
  // CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — checklist de ativação
  // dispensável no topo do dashboard (item 2 do escopo). 4 passos, cada um
  // aponta para uma rota estática real (`ROUTES.app`) — decisão registrada
  // no relatório da task: rotas dinâmicas (`pacientes/[id]`, `consulta/
  // [idPet]` etc.) exigiriam um paciente concreto em contexto, que o
  // dashboard não tem.
  ONBOARDING: {
    TITLE: 'Primeiros passos',
    SUBTITLE_REMAINING: (n: number, total: number) => `${n} de ${total} restantes`,
    SUBTITLE_DONE: 'Você concluiu os primeiros passos.',
    CLOSE_A11Y: 'Dispensar checklist de primeiros passos',
    STEP_AGENDA: 'Veja sua agenda da semana',
    STEP_PACIENTES: 'Veja a lista de pacientes',
    STEP_LUNA: 'Conheça a Luna, sua assistente de IA',
    STEP_SETTINGS: 'Confira suas configurações',
    REVER: 'Rever primeiros passos',
    REVER_CAPTION: 'Mostra de novo o checklist de ativação no topo do dashboard',
  },
} as const;
