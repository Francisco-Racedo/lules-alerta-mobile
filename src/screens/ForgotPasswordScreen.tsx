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
import {
  BASE_URL,
  fetchWithTimeout,
  getErrorMessage,
  isValidDni,
  isValidRecoveryCode,
  MAX_PASSWORD_LENGTH,
} from '../services/auth';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [dni, setDni] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [isLoading, setIsLoading] = useState(false);

  const requestCode = async () => {
    Keyboard.dismiss();

    if (!isValidDni(dni)) {
      Alert.alert('DNI inválido', 'Ingresa un DNI de 7 u 8 dígitos.');
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
        'Solicitud procesada',
        'Si los datos son válidos, recibirás un código en tu correo registrado.',
      );
    } catch {
      Alert.alert(
        'Error de conexión',
        'No pudimos conectarnos con el servidor. Inténtalo nuevamente.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const confirmReset = async () => {
    Keyboard.dismiss();

    if (!isValidRecoveryCode(code)) {
      Alert.alert('Código inválido', 'Ingresa el código de 6 dígitos.');
      return;
    }

    if (
      newPassword.length < 6 ||
      newPassword.length > MAX_PASSWORD_LENGTH
    ) {
      Alert.alert(
        'Contraseña inválida',
        `La contraseña debe tener entre 6 y ${MAX_PASSWORD_LENGTH} caracteres.`,
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Contraseñas diferentes', 'Las contraseñas no coinciden.');
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
          'No se pudo cambiar la contraseña',
          getErrorMessage(data) || 'El código no es válido o ya venció.',
        );
        return;
      }

      Alert.alert(
        'Contraseña actualizada',
        'Ya puedes iniciar sesión con tu nueva contraseña.',
        [{ text: 'ACEPTAR', onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert(
        'Error de conexión',
        'No pudimos conectarnos con el servidor. Inténtalo nuevamente.',
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Ionicons name="key-outline" size={64} color="#E63946" />
          <Text style={styles.title}>Recuperar contraseña</Text>
          <Text style={styles.subtitle}>
            {step === 'request'
              ? 'Ingresa tu DNI para solicitar un código de recuperación.'
              : 'Ingresa el código recibido y define una nueva contraseña.'}
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Número de DNI"
          keyboardType="numeric"
          maxLength={8}
          value={dni}
          onChangeText={(text) => setDni(text.replace(/[^0-9]/g, ''))}
          editable={step === 'request' && !isLoading}
        />

        {step === 'confirm' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Código de 6 dígitos"
              keyboardType="numeric"
              maxLength={6}
              value={code}
              onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
              editable={!isLoading}
            />
            <View style={styles.passwordInputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#666"
                style={styles.icon}
              />
              <TextInput
                style={styles.passwordInput}
                placeholder="Nueva contraseña"
                secureTextEntry={!showNewPassword}
                maxLength={MAX_PASSWORD_LENGTH}
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                style={styles.eyeIcon}
                disabled={isLoading}
              >
                <Ionicons
                  name={
                    showNewPassword ? 'eye-off-outline' : 'eye-outline'
                  }
                  size={22}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            <View style={styles.passwordInputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#666"
                style={styles.icon}
              />
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirmar nueva contraseña"
                secureTextEntry={!showConfirmPassword}
                maxLength={MAX_PASSWORD_LENGTH}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
                disabled={isLoading}
              >
                <Ionicons
                  name={
                    showConfirmPassword ? 'eye-off-outline' : 'eye-outline'
                  }
                  size={22}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={step === 'request' ? requestCode : confirmReset}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {step === 'request' ? 'SOLICITAR CÓDIGO' : 'CAMBIAR CONTRASEÑA'}
            </Text>
          )}
        </TouchableOpacity>

        {step === 'confirm' ? (
          <TouchableOpacity
            onPress={() => setStep('request')}
            disabled={isLoading}
          >
            <Text style={styles.secondaryAction}>Solicitar otro código</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 30,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 25,
    padding: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 35,
  },
  title: {
    color: '#333',
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    color: '#666',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderRadius: 10,
    borderWidth: 1,
    color: '#333',
    fontSize: 16,
    height: 55,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  passwordInputContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 55,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  icon: {
    marginRight: 10,
  },
  passwordInput: {
    color: '#333',
    flex: 1,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 5,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#E63946',
    borderRadius: 10,
    height: 55,
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#e57373',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  secondaryAction: {
    color: '#E63946',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 22,
    textAlign: 'center',
  },
});
