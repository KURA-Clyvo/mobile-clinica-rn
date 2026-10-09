import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { avisar } from '@components/feedback/confirmar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCButton } from '@components/primitives/KCButton';
import { KCIcon } from '@components/primitives/KCIcon';
import { KCEmptyState } from '@components/primitives/KCEmptyState';
import { PetForm } from '@components/domain/PetForm';
import { ConviteTutorView } from '@components/domain/ConviteTutorView';
import { ROUTES } from '@constants/routes';
import { useBuscarTutores, useReemitirConvite } from '@hooks/useTutores';
import { mensagemErroReemissaoConvite } from '@services/tutores.service';
import type { ApiError, ConviteTutor, TutorBuscaWireDto } from '../../../types/api';

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    section: { gap: 16, paddingBottom: 8 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    title: { fontFamily: 'Lexend_500Medium', fontSize: 18, color: colors.text },
    subtitulo: { fontFamily: 'Lexend_400Regular', fontSize: 13, color: colors.textMuteInk },
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
    searchInput: {
      flex: 1,
      fontFamily: 'Lexend_400Regular',
      fontSize: 15,
      color: colors.text,
    },
    tutorItem: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tutorNome: { fontFamily: 'Lexend_500Medium', fontSize: 15, color: colors.text },
    tutorSub: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMuteInk },
    sucessoCentro: { alignItems: 'center', gap: 16, paddingVertical: 8 },
    sucessoTexto: { fontFamily: 'Lexend_500Medium', fontSize: 17, color: colors.text, textAlign: 'center' },
    // REC-04 fix wave (G2, I-1b) — mesmo estilo de "sem link" de ConviteTutorView,
    // reaproveitado aqui por ser o MESMO tom (aviso informativo, não erro).
    semContaBox: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgSunk,
      borderRadius: 10,
      padding: 14,
      gap: 6,
    },
    semContaTexto: { fontFamily: 'Lexend_400Regular', fontSize: 13, color: colors.text, lineHeight: 19, textAlign: 'center' },
  });

/**
 * REC-04 — "Adicionar pet a partir de um tutor existente". Entrada: botão
 * "+ Novo" de pacientes/index.tsx (que antes só mostrava um Alert
 * "funcionalidade em breve"). Diferente da cadeia tutor->pet->convite de
 * tutores/novo.tsx (tutor RECÉM-criado, com convite pendente), aqui o pet é
 * de um tutor que JÁ EXISTE no cadastro — mas "já existe" não é o mesmo que
 * "já tem conta no app" (a conta só nasce quando o tutor aceita o convite;
 * fix wave G2, achado I-1 — a frase anterior desta doc, "aqui o tutor JÁ tem
 * conta", era uma premissa FALSA). Por isso, depois de salvar o pet, a tela
 * oferece "Gerar convite" (REC-02, `POST /tutores/{id}/convite`) — 201
 * mostra o convite normalmente (reaproveitando `ConviteTutorView`, mesmo
 * componente da cadeia de tutores/novo.tsx); 409 informa que o tutor JÁ tem
 * conta de verdade (a única fonte confiável dessa informação é o próprio
 * servidor, nunca uma suposição da tela).
 *
 * Não existe tela de "ficha"/lista de tutor neste app (medido: `find
 * src/app -iname "*tutor*"` só acha `tutores/novo.tsx`) — por isso a busca
 * (GET /api/v1/tutores?busca=, TutoresController.cs:29-35) mora aqui dentro,
 * não em uma tela separada. Reaproveita PetForm (mesmo componente da cadeia
 * de tutores/novo.tsx) para o formulário de pet em si.
 */
export default function NovoPacienteScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();

  const [busca, setBusca] = useState('');
  const [tutorSelecionado, setTutorSelecionado] = useState<TutorBuscaWireDto | null>(null);
  const [salvo, setSalvo] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [buscaDebounced, setBuscaDebounced] = useState('');

  // REC-04 fix wave (G2, I-1b): "Gerar convite" depois do pet salvo.
  // `convite` != null -> mostra o convite (201, ConviteTutorView).
  // `mensagemSemConta` != null -> 409 real do servidor ("já tem conta").
  const [convite, setConvite] = useState<ConviteTutor | null>(null);
  const [mensagemSemConta, setMensagemSemConta] = useState<string | null>(null);
  const { mutate: reemitir, isPending: gerandoConvite } = useReemitirConvite();

  const { data: tutores = [], isLoading } = useBuscarTutores(buscaDebounced);

  // Mesmo espírito do C-1 da REC-03 (tutores/novo.tsx): zera tudo ao perder
  // o foco, pra próxima visita começar sempre do zero.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setBusca('');
        setBuscaDebounced('');
        setTutorSelecionado(null);
        setSalvo(false);
        setConvite(null);
        setMensagemSemConta(null);
      };
    }, []),
  );

  const handleBuscaChange = (texto: string) => {
    setBusca(texto);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBuscaDebounced(texto.trim()), 300);
  };

  // REC-04 fix wave (G2, I-1b): "Gerar convite" — 201 mostra o convite
  // (ConviteTutorView), 409 é o tutor JÁ ter conta de verdade (mensagem
  // própria, não um Alert — é uma informação boa, não um erro), qualquer
  // outro status é genérico (mesmo padrão de mensagemErroReemissaoConvite,
  // regra m1 herdada da REC-03: nunca `err.message` cru fora do 400).
  const handleGerarConvite = () => {
    if (!tutorSelecionado) return;
    reemitir(
      {
        idTutor: tutorSelecionado.id,
        nomeTutor: tutorSelecionado.nmTutor,
        whatsapp: tutorSelecionado.nrTelefone,
      },
      {
        onSuccess: (resultado) => setConvite(resultado),
        onError: (err: unknown) => {
          const apiError = err as ApiError;
          if (apiError.status === 409) {
            setMensagemSemConta('Este tutor já tem conta no app — não precisa de convite.');
            return;
          }
          void avisar({
            titulo: 'Não foi possível gerar o convite',
            mensagem: mensagemErroReemissaoConvite(apiError),
          });
        },
      },
    );
  };

  if (convite) {
    return <ConviteTutorView convite={convite} onConviteAtualizado={setConvite} />;
  }

  if (salvo) {
    return (
      <ScreenContainer>
        <View style={styles.sucessoCentro}>
          <KCIcon name="check" size={40} color={colors.success} />
          <Text style={styles.sucessoTexto}>Pet cadastrado com sucesso!</Text>

          {mensagemSemConta ? (
            <View style={styles.semContaBox} testID="sem-conta-aviso">
              <Text style={styles.semContaTexto}>{mensagemSemConta}</Text>
            </View>
          ) : (
            <KCButton
              variant="ghost"
              loading={gerandoConvite}
              disabled={gerandoConvite}
              onPress={handleGerarConvite}
              accessibilityLabel="Gerar convite para o tutor baixar o app"
              testID="btn-gerar-convite"
            >
              Gerar convite
            </KCButton>
          )}

          <KCButton
            variant="secondary"
            onPress={() => router.push(ROUTES.app.pacientes)}
            accessibilityLabel="Voltar para pacientes"
            testID="btn-voltar-pet-salvo"
          >
            Voltar
          </KCButton>
        </View>
      </ScreenContainer>
    );
  }

  if (tutorSelecionado) {
    return (
      <ScreenContainer keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setTutorSelecionado(null)}
            testID="btn-voltar-selecao-tutor"
            accessibilityLabel="Voltar para a busca de tutor"
          >
            <KCIcon name="back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Novo pet</Text>
        </View>
        <PetForm
          idTutor={tutorSelecionado.id}
          nomeTutor={tutorSelecionado.nmTutor}
          onSuccess={() => setSalvo(true)}
          onError={(mensagem) => void avisar({ titulo: 'Não foi possível cadastrar o pet', mensagem })}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.push(ROUTES.app.pacientes)}
            testID="btn-voltar-novo-paciente"
            accessibilityLabel="Voltar"
          >
            <KCIcon name="back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Novo paciente</Text>
        </View>
        <Text style={styles.subtitulo}>
          Busque o tutor pelo nome ou CPF para cadastrar o pet dele. Tutor novo? Use "Novo
          tutor" na tela anterior.
        </Text>

        <View style={styles.searchWrapper}>
          <KCIcon name="search" size={18} color={colors.textMuteInk} />
          <TextInput
            style={styles.searchInput}
            placeholder="Nome ou CPF do tutor"
            placeholderTextColor={colors.textMuteInk}
            value={busca}
            onChangeText={handleBuscaChange}
            testID="search-tutor-existente"
          />
        </View>

        {busca.trim().length > 0 && busca.trim().length < 2 && (
          <Text style={styles.subtitulo}>Digite ao menos 2 caracteres para buscar.</Text>
        )}

        {buscaDebounced.length >= 2 && !isLoading && tutores.length === 0 && (
          <KCEmptyState
            icon="patients"
            title="Nenhum tutor encontrado"
            description="Confira o nome ou CPF digitado, ou cadastre um tutor novo."
            testID="empty-busca-tutor"
          />
        )}

        {tutores.length > 0 && (
          <FlatList
            data={tutores}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.tutorItem}
                onPress={() => setTutorSelecionado(item)}
                testID={`tutor-item-${item.id}`}
              >
                <Text style={styles.tutorNome}>{item.nmTutor}</Text>
                <Text style={styles.tutorSub}>{item.dsEmail}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
