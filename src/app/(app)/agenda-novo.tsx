import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { voltarOu } from '@utils/navegacao';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@theme/index';
import { lightColors, touchTarget } from '@theme/tokens';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCButton } from '@components/primitives/KCButton';
import { KCChip } from '@components/primitives/KCChip';
import { KCIcon } from '@components/primitives/KCIcon';
import { KCEmptyState } from '@components/primitives/KCEmptyState';
import { ErrorState } from '@components/feedback/ErrorState';
import { useBuscarTutores } from '@hooks/useTutores';
import { useVeterinariosParaSelecao } from '@hooks/useUsuariosClinica';
import { usePets } from '@hooks/usePets';
import { useCriarAgendamento, useCheckinAgendamento } from '@hooks/useAgenda';
import { getTutorById } from '@services/tutores.service';
import { getPetById } from '@services/pets.service';
import { TIPOS_AGENDAMENTO_PERMITIDOS, AGENDAMENTO_OBSERVACOES_MAX_BYTES } from '@services/agenda.service';
import { formatDateTimeLocalSemFuso, formatDateShort, formatTime } from '@utils/date';
import { ROUTES } from '@constants/routes';
import { STRINGS } from '@constants/strings';
import type { ApiError, PetResponse, TutorBuscaWireDto } from '../../types/api';

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    // BR-CLI-T05: alvo de toque 44x44 (era o icone solto, 20x20); margem negativa mantem o icone no lugar.
    backBtn: { minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
    section: { gap: 16, paddingBottom: 24 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { fontFamily: 'Lexend_500Medium', fontSize: 18, color: colors.text },
    sectionLabel: { fontFamily: 'Lexend_500Medium', fontSize: 13, color: colors.text },
    subtitulo: { fontFamily: 'Lexend_400Regular', fontSize: 13, color: colors.textMuteInk },
    box: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      gap: 8,
    },
    searchWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderControl,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 8,
    },
    searchInput: { flex: 1, fontFamily: 'Lexend_400Regular', fontSize: 15, color: colors.text },
    itemRow: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemRowSelected: { borderColor: colors.primary, backgroundColor: colors.bgSunk },
    itemTitle: { fontFamily: 'Lexend_500Medium', fontSize: 14, color: colors.text },
    itemSub: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMuteInk },
    lockedBox: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgSunk,
      borderRadius: 10,
      padding: 12,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
    },
    dateText: { fontFamily: 'Lexend_400Regular', fontSize: 15, color: colors.text },
    errorText: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.danger },
    input: {
      borderWidth: 1,
      borderColor: colors.borderControl,
      borderRadius: 10,
      padding: 12,
      fontFamily: 'Lexend_400Regular',
      fontSize: 14,
      color: colors.text,
      minHeight: 72,
      textAlignVertical: 'top',
    },
  });

const TIPO_LABEL: Record<string, string> = {
  CONSULTA: 'Consulta',
  RETORNO: 'Retorno',
  VACINA: 'Vacina',
  EXAME: 'Exame',
  PROCEDIMENTO: 'Procedimento',
  TELEORIENTACAO: 'Teleorientação',
};

/**
 * REC-14 — formulário de novo agendamento. Arquivo FLAT (`agenda-novo.tsx`, não
 * `agenda/novo.tsx`) — ver comentário em `routes.ts::agendaNovo`.
 *
 * 3 pontos de entrada, todos via query string (mesmo padrão de `consulta`/
 * `teleorientacao` em `routes.ts`):
 *   - Sem parâmetro (botão "Novo agendamento" em agenda.tsx): tutor e pet abertos.
 *   - `idPet` (botão "Agendar" na ficha do paciente): pet e tutor TRAVADOS (o pet já
 *     define o tutor principal) — decisão de UX registrada em rec-14-report.md.
 *   - `idTutor` + `idTriagemOrigem` (botão "Agendar" da fila da Luna): tutor travado,
 *     pet ABERTO (E34 — a triagem não sabe o pet, a recepção escolhe na hora).
 *
 * `IdClinica` nunca é enviado (vem do JWT) — mesma regra do DTO real, ver pin em
 * `agenda.service.ts::criarAgendamento`.
 */
export default function NovoAgendamentoScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();

  const params = useLocalSearchParams<{
    idPet?: string;
    idTutor?: string;
    idTriagemOrigem?: string;
  }>();
  const idPetTravado = params.idPet ? parseInt(params.idPet, 10) : null;
  const idTutorPreenchido = params.idTutor ? parseInt(params.idTutor, 10) : null;
  const idTriagemOrigem = params.idTriagemOrigem ? parseInt(params.idTriagemOrigem, 10) : undefined;

  const [idTutor, setIdTutor] = useState<number | null>(idTutorPreenchido);
  const [nomeTutor, setNomeTutor] = useState<string>('');
  const [idPet, setIdPet] = useState<number | null>(idPetTravado);
  const [nomePet, setNomePet] = useState<string>('');
  const [idVeterinario, setIdVeterinario] = useState<number | null>(null);
  const [dtAgendamento, setDtAgendamento] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dsTipo, setDsTipo] = useState<string | null>(null);
  const [dsObservacoes, setDsObservacoes] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  // G2/A-1 — "Encaixe agora" encadeia 2 chamadas (criar + checkin); o `onSettled` do
  // checkin rodava TANTO no sucesso quanto no erro, e os dois caiam na MESMA tela de
  // "Agendamento criado com sucesso!" — um check-in que falha (404/409/422; o 409 de
  // `nrVersion` é plausível de verdade, corrida com a agenda aberta em outro
  // aparelho) ficava SILENCIADO, e a recepção saía da tela achando que a chegada
  // tinha sido registrada. Este flag distingue os 2 desfechos na MESMA tela de
  // sucesso (o agendamento FOI criado nos dois casos — só o check-in que não).
  const [checkinFalhou, setCheckinFalhou] = useState(false);

  const { mutate: criar, isPending: salvando } = useCriarAgendamento();
  const { mutate: checkin, isPending: fazendoCheckin } = useCheckinAgendamento();

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setErroServidor(null);
        setSalvo(false);
        setCheckinFalhou(false);
      };
    }, []),
  );

  // Pet travado (entrada pela ficha do paciente): resolve nome do pet E o tutor
  // principal dele — o pet já existe, então o tutor não precisa ser escolhido de novo.
  useEffect(() => {
    if (!idPetTravado) return;
    getPetById(idPetTravado)
      .then((pet) => {
        setNomePet(pet.nmPet);
        // REC-17 ("Remarcar" da linha do tutor): quando a tela abre com `idPet` E
        // `idTutor`, o tutor pedido (quem respondeu ao lembrete) vale mais que o
        // principal do pet — um pet com 2 tutores remarcaria no nome errado.
        // Sem `idTutor` (ficha do paciente) o comportamento é o de sempre.
        const escolhido =
          (idTutorPreenchido ? pet.tutores.find((t) => t.idTutor === idTutorPreenchido) : undefined) ??
          pet.tutores.find((t) => t.stPrincipal) ??
          pet.tutores[0];
        if (escolhido) {
          setIdTutor(escolhido.idTutor);
          setNomeTutor(escolhido.nmTutor);
        }
      })
      .catch(() => {
        /* pet inexistente — a tela continua utilizável, o submit vai falhar com 404 real */
      });
  }, [idPetTravado, idTutorPreenchido]);

  // Tutor preenchido pela fila da Luna: resolve o nome pra exibir (a fila nunca
  // carrega nome de exibição formatado além do que o card já mostrou).
  useEffect(() => {
    // Com `idPet` também travado, o efeito do pet acima já resolve o nome do
    // tutor a partir de `pet.tutores` — rodar os dois deixaria o nome na mão
    // de quem respondesse por último.
    if (!idTutorPreenchido || idPetTravado) return;
    getTutorById(idTutorPreenchido)
      .then((tutor) => setNomeTutor(tutor.nmTutor))
      .catch(() => {
        /* tutor inexistente — submit vai falhar com 404 real */
      });
  }, [idTutorPreenchido, idPetTravado]);

  const handleBuscaChange = (texto: string) => {
    setBusca(texto);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBuscaDebounced(texto.trim()), 300);
  };

  const {
    data: tutoresEncontrados = [],
    isLoading: buscandoTutores,
    isError: buscaTutoresFalhou,
    refetch: refazerBuscaTutores,
  } = useBuscarTutores(buscaDebounced);

  const handleSelecionarTutor = (tutor: TutorBuscaWireDto) => {
    setIdTutor(tutor.id);
    setNomeTutor(tutor.nmTutor);
    setIdPet(null);
    setNomePet('');
  };

  // Pets do tutor selecionado (aberto): filtro em memória sobre a listagem inteira —
  // mesmo padrão de `pets.service.ts::listPets(filtro)`, que já filtra client-side.
  const { data: todosPets = [], isError: petsFalhou, refetch: refazerPets } = usePets();
  const petsDoTutor = useMemo(
    () => (idTutor ? todosPets.filter((p) => p.tutores.some((t) => t.idTutor === idTutor)) : []),
    [todosPets, idTutor],
  );

  const { data: veterinarios = [], isError: veterinariosFalhou, refetch: refazerVeterinarios } =
    useVeterinariosParaSelecao();

  const observacoesBytes = useMemo(() => contarBytesUtf8(dsObservacoes), [dsObservacoes]);
  const observacoesExcedeu = observacoesBytes > AGENDAMENTO_OBSERVACOES_MAX_BYTES;

  const podeSubmeter =
    !!idTutor && !!idPet && !!idVeterinario && !!dsTipo && !observacoesExcedeu && !salvando && !fazendoCheckin;

  function mensagemErro(err: ApiError): string {
    if (err.status === 400) {
      return (
        Object.values(err.details ?? {})
          .flat()
          .join(' ') ||
        err.message ||
        STRINGS.AGENDA_NOVO.ERRO_GENERICO
      );
    }
    if (err.status === 404 || err.status === 422) {
      return err.message || STRINGS.AGENDA_NOVO.ERRO_GENERICO;
    }
    return STRINGS.AGENDA_NOVO.ERRO_GENERICO;
  }

  const montarDto = () => ({
    idTutor: idTutor!,
    idPet: idPet!,
    idVeterinario: idVeterinario!,
    dtAgendamento: formatDateTimeLocalSemFuso(dtAgendamento),
    dsTipo: dsTipo!,
    dsObservacoes: dsObservacoes.trim() ? dsObservacoes.trim() : undefined,
    // idTriagemOrigem SÓ vai no corpo quando a tela foi aberta pela fila da Luna —
    // nunca um valor inventado. Mordida do backlog: omitir este campo faz o
    // agendamento nascer com DsOrigem='RECEPCAO' em vez de 'TRIAGEM_LUNA'.
    ...(typeof idTriagemOrigem === 'number' ? { idTriagemOrigem } : {}),
  });

  const handleSalvar = () => {
    if (!podeSubmeter) return;
    setErroServidor(null);
    criar(montarDto(), {
      onSuccess: () => {
        setSalvo(true);
      },
      onError: (err: unknown) => {
        setErroServidor(mensagemErro(err as ApiError));
      },
    });
  };

  // "Encaixe agora" — hora ATUAL do aparelho (não há como o app ler o relógio da
  // clínica; quem decide de verdade é o servidor, IRelogioClinica — a tolerância de
  // 15 min de encaixe é sempre aplicada lá, isto só evita um 422 óbvio no caso comum
  // de aparelho com hora correta). Cria e, no MESMO gesto, chama check-in.
  const handleEncaixeAgora = () => {
    if (!idTutor || !idPet || !idVeterinario || !dsTipo || observacoesExcedeu) return;
    setErroServidor(null);
    setCheckinFalhou(false);
    const agora = new Date();
    setDtAgendamento(agora);
    criar(
      { ...montarDto(), dtAgendamento: formatDateTimeLocalSemFuso(agora) },
      {
        onSuccess: (agendamento) => {
          // G2/A-1 — sucesso e erro do check-in NÃO podem levar à mesma afirmação: o
          // agendamento foi criado nos 2 casos, mas só no sucesso a chegada foi
          // REGISTRADA de verdade. `onSettled` antigo escondia essa diferença.
          checkin(
            { idAgendamento: agendamento.id, nrVersion: agendamento.nrVersion },
            {
              onSuccess: () => setSalvo(true),
              onError: () => {
                setCheckinFalhou(true);
                setSalvo(true);
              },
            },
          );
        },
        onError: (err: unknown) => {
          setErroServidor(mensagemErro(err as ApiError));
        },
      },
    );
  };

  if (salvo) {
    return (
      <ScreenContainer>
        <View style={styles.section}>
          <KCIcon name="check" size={40} color={colors.success} />
          {checkinFalhou ? (
            <>
              <Text style={styles.title} testID="aviso-checkin-falhou">
                {STRINGS.AGENDA_NOVO.CHECKIN_FALHOU_TITULO}
              </Text>
              <Text style={styles.subtitulo}>{STRINGS.AGENDA_NOVO.CHECKIN_FALHOU_DESC}</Text>
            </>
          ) : (
            <Text style={styles.title}>Agendamento criado com sucesso!</Text>
          )}
          <KCButton
            variant="secondary"
            onPress={() => router.push(ROUTES.app.agenda)}
            testID="btn-voltar-agenda-novo"
            accessibilityLabel="Voltar para a agenda"
          >
            Voltar para a agenda
          </KCButton>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.backBtn}
            onPress={() => voltarOu(router, ROUTES.app.agenda)}
            testID="btn-voltar-agenda-novo-form"
            accessibilityLabel="Voltar"
          >
            <KCIcon name="back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{STRINGS.AGENDA_NOVO.TITLE}</Text>
        </View>

        {/* TUTOR */}
        <View>
          <Text style={styles.sectionLabel}>{STRINGS.AGENDA_NOVO.STEP_TUTOR}</Text>
          {idPetTravado || idTutorPreenchido ? (
            <View style={styles.lockedBox} testID="tutor-travado">
              <Text style={styles.itemTitle}>{nomeTutor || `Tutor ${idTutor ?? ''}`}</Text>
            </View>
          ) : (
            <>
              {idTutor && (
                <View style={[styles.itemRow, styles.itemRowSelected]} testID="tutor-selecionado">
                  <Text style={styles.itemTitle}>{nomeTutor}</Text>
                </View>
              )}
              <View style={styles.searchWrapper}>
                <KCIcon name="search" size={18} color={colors.textMuteInk} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={STRINGS.AGENDA_NOVO.BUSCAR_TUTOR_PLACEHOLDER}
                  placeholderTextColor={colors.textMuteInk}
                  value={busca}
                  onChangeText={handleBuscaChange}
                  testID="search-tutor-novo-agendamento"
                />
              </View>
              {buscaTutoresFalhou && (
                <ErrorState
                  compacto
                  titulo="Não foi possível buscar os tutores"
                  onRetry={() => void refazerBuscaTutores()}
                  testID="erro-busca-tutores"
                />
              )}
              {!buscandoTutores && tutoresEncontrados.length > 0 && (
                <FlatList
                  data={tutoresEncontrados}
                  keyExtractor={(item) => String(item.id)}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={styles.itemRow}
                      onPress={() => handleSelecionarTutor(item)}
                      testID={`tutor-opcao-${item.id}`}
                    >
                      <Text style={styles.itemTitle}>{item.nmTutor}</Text>
                      <Text style={styles.itemSub}>{item.dsEmail}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          )}
        </View>

        {/* PET */}
        <View>
          <Text style={styles.sectionLabel}>{STRINGS.AGENDA_NOVO.STEP_PET}</Text>
          {idPetTravado ? (
            <View style={styles.lockedBox} testID="pet-travado">
              <Text style={styles.itemTitle}>{nomePet || `Pet ${idPetTravado}`}</Text>
            </View>
          ) : !idTutor ? (
            <Text style={styles.subtitulo}>{STRINGS.AGENDA_NOVO.SEM_TUTOR_SELECIONADO}</Text>
          ) : petsFalhou ? (
            // Erro != "o tutor não tem pet": não afirmar ausência quando a lista não carregou.
            <ErrorState
              compacto
              titulo="Não foi possível carregar os pets"
              onRetry={() => void refazerPets()}
              testID="erro-pets"
            />
          ) : petsDoTutor.length === 0 ? (
            <Text style={styles.subtitulo}>{STRINGS.AGENDA_NOVO.SEM_PET_PARA_TUTOR}</Text>
          ) : (
            <View style={styles.chipRow}>
              {petsDoTutor.map((pet: PetResponse) => (
                <KCChip
                  key={pet.id}
                  tone={idPet === pet.id ? 'ocean' : 'mute'}
                  onPress={() => {
                    setIdPet(pet.id);
                    setNomePet(pet.nmPet);
                  }}
                  testID={`pet-opcao-${pet.id}`}
                >
                  {pet.nmPet}
                </KCChip>
              ))}
            </View>
          )}
        </View>

        {/* VETERINÁRIO */}
        <View>
          <Text style={styles.sectionLabel}>{STRINGS.AGENDA_NOVO.STEP_VETERINARIO}</Text>
          {veterinariosFalhou && (
            <ErrorState
              compacto
              titulo="Não foi possível carregar os veterinários"
              onRetry={() => void refazerVeterinarios()}
              testID="erro-veterinarios"
            />
          )}
          <View style={styles.chipRow}>
            {veterinarios.map((vet) => (
              <KCChip
                key={vet.id}
                tone={idVeterinario === vet.id ? 'ocean' : 'mute'}
                onPress={() => setIdVeterinario(vet.id)}
                testID={`vet-opcao-${vet.id}`}
              >
                {vet.nmVeterinario}
              </KCChip>
            ))}
          </View>
        </View>

        {/* DATA/HORA */}
        <View>
          <Text style={styles.sectionLabel}>{STRINGS.AGENDA_NOVO.STEP_DATA_HORA}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* KCButton (não TouchableOpacity cru) de propósito: evita acrescentar
                tocável novo ao inventário de `touchTargetRegistry.tsx` (CQ-08) — o
                componente já carrega sua própria geometria de alvo de toque, coberta
                pela entrada genérica de `KCButton.tsx`. */}
            <KCButton
              variant="secondary"
              size="sm"
              onPress={() => setShowDatePicker(true)}
              testID="date-picker-trigger-agendamento"
              accessibilityLabel="Escolher data do agendamento"
            >
              {formatDateShort(dtAgendamento)}
            </KCButton>
            <KCButton
              variant="secondary"
              size="sm"
              onPress={() => setShowTimePicker(true)}
              testID="time-picker-trigger-agendamento"
              accessibilityLabel="Escolher hora do agendamento"
            >
              {formatTime(dtAgendamento)}
            </KCButton>
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={dtAgendamento}
              mode="date"
              onChange={(_: unknown, date?: Date) => {
                setShowDatePicker(false);
                if (date) {
                  const novo = new Date(dtAgendamento);
                  novo.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                  setDtAgendamento(novo);
                }
              }}
              testID="date-time-picker-agendamento-data"
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={dtAgendamento}
              mode="time"
              onChange={(_: unknown, date?: Date) => {
                setShowTimePicker(false);
                if (date) {
                  const novo = new Date(dtAgendamento);
                  novo.setHours(date.getHours(), date.getMinutes(), 0, 0);
                  setDtAgendamento(novo);
                }
              }}
              testID="date-time-picker-agendamento-hora"
            />
          )}
          <KCButton
            variant="ghost"
            size="sm"
            onPress={handleEncaixeAgora}
            disabled={!idTutor || !idPet || !idVeterinario || !dsTipo || observacoesExcedeu || salvando || fazendoCheckin}
            loading={salvando || fazendoCheckin}
            testID="btn-encaixe-agora"
            accessibilityLabel={STRINGS.agenda.encaixeAgora}
          >
            {STRINGS.agenda.encaixeAgora}
          </KCButton>
          <Text style={styles.subtitulo}>{STRINGS.agenda.encaixeAgoraDesc}</Text>
        </View>

        {/* TIPO */}
        <View>
          <Text style={styles.sectionLabel}>{STRINGS.AGENDA_NOVO.STEP_TIPO}</Text>
          <View style={styles.chipRow}>
            {TIPOS_AGENDAMENTO_PERMITIDOS.map((tipo) => (
              <KCChip
                key={tipo}
                tone={dsTipo === tipo ? 'ocean' : 'mute'}
                onPress={() => setDsTipo(tipo)}
                testID={`tipo-opcao-${tipo}`}
              >
                {TIPO_LABEL[tipo] ?? tipo}
              </KCChip>
            ))}
          </View>
        </View>

        {/* OBSERVAÇÕES */}
        <View>
          <Text style={styles.sectionLabel}>{STRINGS.AGENDA_NOVO.OBSERVACOES}</Text>
          <TextInput
            style={styles.input}
            multiline
            value={dsObservacoes}
            onChangeText={setDsObservacoes}
            testID="input-observacoes-agendamento"
          />
          {observacoesExcedeu && (
            <Text style={styles.errorText} testID="erro-observacoes-agendamento">
              {`Observações muito longas (${observacoesBytes}/${AGENDAMENTO_OBSERVACOES_MAX_BYTES} bytes).`}
            </Text>
          )}
        </View>

        {erroServidor && (
          <View style={styles.box} testID="erro-servidor-agendamento">
            <Text style={styles.errorText}>{erroServidor}</Text>
          </View>
        )}

        {!idPetTravado && !idTutorPreenchido && !idTutor && (
          <KCEmptyState
            icon="agenda"
            title="Selecione um tutor"
            description="Busque o tutor para começar o agendamento."
            testID="empty-tutor-novo-agendamento"
          />
        )}

        <KCButton
          variant="primary"
          size="lg"
          loading={salvando}
          disabled={!podeSubmeter}
          onPress={handleSalvar}
          accessibilityLabel={STRINGS.AGENDA_NOVO.SALVAR}
          testID="btn-salvar-agendamento"
        >
          {STRINGS.AGENDA_NOVO.SALVAR}
        </KCButton>
      </View>
    </ScreenContainer>
  );
}

function contarBytesUtf8(texto: string): number {
  let bytes = 0;
  for (const char of texto) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}
