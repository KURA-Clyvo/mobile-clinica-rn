import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  KeyboardTypeOptions,
} from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';

export interface KCTextFieldProps {
  label: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    wrapper: {},
    label: {
      fontSize: 12,
      color: colors.textSoft,
      marginBottom: 4,
      fontFamily: 'Lexend_400Regular',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
    },
    inputContainerNormal: {
      borderColor: colors.border,
    },
    inputContainerFocused: {
      borderColor: colors.borderFocus,
    },
    inputContainerError: {
      borderColor: colors.danger,
    },
    inputContainerDisabled: {
      backgroundColor: colors.bgSunk,
      opacity: 0.6,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      fontFamily: 'Lexend_400Regular',
      padding: 0,
    },
    feedbackRow: {
      height: 16,
      marginTop: 3,
    },
    errorText: {
      fontSize: 11,
      color: colors.danger,
      fontFamily: 'Lexend_400Regular',
    },
    helperText: {
      fontSize: 11,
      color: colors.textMute,
      fontFamily: 'Lexend_400Regular',
    },
    eyeButton: {
      paddingLeft: 8,
    },
    eyeText: {
      fontSize: 16,
      color: colors.textMute,
    },
  });

export function KCTextField({
  label,
  placeholder,
  error,
  helperText,
  secureTextEntry = false,
  keyboardType,
  value,
  onChangeText,
  onBlur,
  editable = true,
  style,
  accessibilityLabel,
  testID,
}: KCTextFieldProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(secureTextEntry);

  const borderStyle = error
    ? styles.inputContainerError
    : isFocused
    ? styles.inputContainerFocused
    : styles.inputContainerNormal;

  return (
    <View style={[styles.wrapper, style]}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          borderStyle,
          !editable && styles.inputContainerDisabled,
        ]}
      >
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMute}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          editable={editable}
          autoCorrect={keyboardType === 'email-address' ? false : undefined}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : undefined}
          accessibilityLabel={accessibilityLabel ?? label}
          testID={testID ?? 'kc-text-input'}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsSecure(v => !v)}
            style={styles.eyeButton}
            testID="password-toggle"
            accessibilityLabel={isSecure ? 'Mostrar senha' : 'Ocultar senha'}
          >
            <Text style={styles.eyeText}>{isSecure ? '👁' : '🙈'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.feedbackRow}>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : helperText ? (
          <Text style={styles.helperText}>{helperText}</Text>
        ) : null}
      </View>
    </View>
  );
}
