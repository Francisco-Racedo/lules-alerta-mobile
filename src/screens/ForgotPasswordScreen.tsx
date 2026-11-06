import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BASE_URL,
  fetchWithTimeout,
  getErrorMessage,
  isValidDni,
  isValidRecoveryCode,
  MAX_PASSWORD_LENGTH,
} from '../services/auth';

export default function ForgotPasswordScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [dni, setDni] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const requestCode = async () => {
    Keyboard.dismiss();

    if (!isValidDni(dni)) {
      Alert.alert('DNI Inválido', 'Ingresa un DNI de 7 u 8 dígitos sin puntos ni guiones.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetchWithTimeout(
        `${BASE_URL}/users/password-recovery/request`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dni }),
        },
      );
      const data: unknown = await response.json();

      if (!response.ok) {
        Alert.alert(
          'No se pudo procesar la solicitud',
          getErrorMessage(data) || 'Inténtalo nuevamente.',
        );
        return;
      }

      setStep('confirm');
      Alert.alert(
        'Código Enviado',
        'Si los datos corresponden a un usuario registrado, recibirás un código de 6 dígitos en tu correo registrado.',
      );
    } catch {
      Alert.alert(
        'Error de Conexión',
        'No pudimos conectarnos con el servidor. Verifica tu conexión a internet.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const confirmReset = async () => {
    Keyboard.dismiss();

    if (!isValidRecoveryCode(code)) {
      Alert.alert('Código Inválido', 'Ingresa el código numérico de 6 dígitos recibido.');
      return;
    }

    if (
      newPassword.length < 6 ||
      newPassword.length > MAX_PASSWORD_LENGTH
    ) {
      Alert.alert(
        'Contraseña Inválida',
        `La nueva contraseña debe tener entre 6 y ${MAX_PASSWORD_LENGTH} caracteres.`,
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Contraseñas Diferentes', 'Las dos contraseñas no coinciden. Verifícalas.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetchWithTimeout(
        `${BASE_URL}/users/password-recovery/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dni, code, newPassword }),
        },
      );
      const data: unknown = await response.json();

      if (!response.ok) {
        Alert.alert(
          'No se pudo restablecer',
          getErrorMessage(data) || 'El código no es válido o ya ha vencido.',
        );
        return;
      }

      Alert.alert(
        '¡Contraseña Actualizada!',
        'Tu contraseña ha sido restablecida con éxito. Ya puedes iniciar sesión con tu nueva clave.',
        [{ text: 'ACEPTAR', onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert(
        'Error de Conexión',
        'No pudimos conectarnos con el servidor. Verifica tu conexión a internet.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 16, 24),
            paddingBottom: Math.max(insets.bottom + 32, 40),
          }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* BOTÓN VOLVER */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Volver a inicio de sesión"
        >
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>

        {/* ENCABEZADO */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="key-outline" size={40} color="#264653" />
          </View>

          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>
              {step === 'request' ? 'PASO 1 DE 2: SOLICITUD' : 'PASO 2 DE 2: VALIDACIÓN'}
            </Text>
          </View>

          <Text style={styles.title}>Recuperar Contraseña</Text>
          <Text style={styles.subtitle}>
            {step === 'request'
              ? 'Ingresa tu DNI para enviar un código de verificación a tu casilla de correo registrada.'
              : 'Ingresa el código de 6 dígitos recibido y define tu nueva contraseña segura.'}
          </Text>
        </View>

        {/* TARJETA DEL FORMULARIO */}
        <View style={styles.formCard}>
          {/* CAMPO DNI */}
          <Text style={styles.fieldLabel}>Documento Nacional de Identidad (DNI)</Text>
          <View style={[
            styles.inputContainer,
            focusedInput === 'dni' && styles.inputFocused,
            step === 'confirm' && styles.inputDisabled
          ]}>
            <Ionicons 
              name="card-outline" 
              size={20} 
              color={focusedInput === 'dni' ? "#264653" : "#64748B"} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={[styles.input, step === 'confirm' && { color: '#64748B' }]}
              placeholder="Número de DNI (sin puntos)"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              maxLength={8}
              value={dni}
              onChangeText={(text) => setDni(text.replace(/[^0-9]/g, ''))}
              onFocus={() => setFocusedInput('dni')}
              onBlur={() => setFocusedInput(null)}
              editable={step === 'request' && !isLoading}
            />
          </View>

          {step === 'confirm' ? (
            <>
              {/* CAMPO CÓDIGO */}
              <Text style={styles.fieldLabel}>Código de Verificación (6 dígitos)</Text>
              <View style={[styles.inputContainer, focusedInput === 'code' && styles.inputFocused]}>
                <Ionicons 
                  name="shield-checkmark-outline" 
                  size={20} 
                  color={focusedInput === 'code' ? "#264653" : "#64748B"} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={[styles.input, { letterSpacing: 3, fontWeight: '800' }]}
                  placeholder="000000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={6}
                  value={code}
                  onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
                  onFocus={() => setFocusedInput('code')}
                  onBlur={() => setFocusedInput(null)}
                  editable={!isLoading}
                />
              </View>

              {/* CAMPO NUEVA CONTRASEÑA */}
              <Text style={styles.fieldLabel}>Nueva Contraseña</Text>
              <View style={[styles.inputContainer, focusedInput === 'newPassword' && styles.inputFocused]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={focusedInput === 'newPassword' ? "#264653" : "#64748B"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showNewPassword}
                  maxLength={MAX_PASSWORD_LENGTH}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  onFocus={() => setFocusedInput('newPassword')}
                  onBlur={() => setFocusedInput(null)}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  style={styles.eyeIcon}
                  disabled={isLoading}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>

              {/* CAMPO CONFIRMAR CONTRASEÑA */}
              <Text style={styles.fieldLabel}>Confirmar Nueva Contraseña</Text>
              <View style={[styles.inputContainer, focusedInput === 'confirmPassword' && styles.inputFocused]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={focusedInput === 'confirmPassword' ? "#264653" : "#64748B"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Repite tu nueva contraseña"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showConfirmPassword}
                  maxLength={MAX_PASSWORD_LENGTH}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setFocusedInput('confirmPassword')}
                  onBlur={() => setFocusedInput(null)}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                  disabled={isLoading}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {/* BOTÓN DE ACCIÓN */}
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={step === 'request' ? requestCode : confirmReset}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnContent}>
                <Text style={styles.buttonText}>
                  {step === 'request' ? 'SOLICITAR CÓDIGO' : 'RESTABLECER CONTRASEÑA'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>

          {step === 'confirm' ? (
            <TouchableOpacity
              onPress={() => setStep('request')}
              disabled={isLoading}
              style={styles.secondaryActionBtn}
            >
              <Ionicons name="refresh-outline" size={16} color="#264653" style={{ marginRight: 6 }} />
              <Text style={styles.secondaryAction}>Reintentar con otro DNI o solicitar nuevo código</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* PIE / VOLVER A LOGIN */}
        <TouchableOpacity 
          style={styles.backToLoginBtn}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        >
          <Text style={styles.backToLoginText}>
            ¿Recordaste tu contraseña? <Text style={styles.backToLoginBold}>Iniciar sesión</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#264653',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 14,
  },
  stepBadge: {
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 8,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#264653',
    letterSpacing: 0.8,
  },
  title: {
    color: '#1E293B',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 14,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 52,
  },
  inputFocused: {
    borderColor: '#264653',
    backgroundColor: '#FFFFFF',
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  eyeIcon: {
    padding: 6,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#264653',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#264653',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 6,
  },
  secondaryAction: {
    color: '#264653',
    fontSize: 13,
    fontWeight: '700',
  },
  backToLoginBtn: {
    alignItems: 'center',
    marginTop: 22,
  },
  backToLoginText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  backToLoginBold: {
    color: '#264653',
    fontWeight: '800',
  },
});
