import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  Platform, Keyboard, Alert, ActivityIndicator, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BASE_URL,
  fetchWithTimeout,
  getErrorMessage,
  isValidDni,
  parseLoginResponse,
} from '../services/auth';
import { registerDeviceForPushNotifications } from '../services/pushNotifications';

export default function LoginScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [dniError, setDniError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [focusedInput, setFocusedInput] = useState<'dni' | 'password' | null>(null);

  const handleDniChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setDni(numericValue);
    if (dniError) setDniError(''); 
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (passwordError) setPasswordError(''); 
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    let isValid = true;
    setDniError('');
    setPasswordError('');

    if (!dni) {
      setDniError('El DNI es obligatorio.');
      isValid = false;
    } else if (!isValidDni(dni)) {
      setDniError('El DNI debe tener entre 7 y 8 dígitos.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('La contraseña es obligatoria.');
      isValid = false;
    }

    if (!isValid) return; 

    setIsLoading(true);

    try {
      const response = await fetchWithTimeout(`${BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dni, password }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const message = getErrorMessage(data);
        Alert.alert(
          'Error de Autenticación',
          message || 'Credenciales incorrectas.',
        );
        return;
      }

      const authResponse = parseLoginResponse(data);

      await AsyncStorage.setItem('userToken', authResponse.access_token);
      await AsyncStorage.setItem(
        'userData',
        JSON.stringify(authResponse.user),
      );

      try {
        await registerDeviceForPushNotifications(authResponse.access_token);
      } catch (error) {
        Alert.alert(
          'Notificaciones',
          error instanceof Error
            ? error.message
            : 'No se pudo activar el registro de notificaciones.',
        );
      }

      navigation.replace('MainTabs');

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
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAwareScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 16) + 32,
          }
        ]}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={Platform.OS === 'ios' ? 24 : 0}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ENCABEZADO CON LOGO OFICIAL CENTRADO */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/logo.png')} 
              style={styles.logoImage} 
              resizeMode="contain" 
            />
          </View>

          <View style={styles.municipalityBadge}>
            <Ionicons name="location-sharp" size={13} color="#2A9D8F" style={{ marginRight: 4 }} />
            <Text style={styles.municipalityText}>SAN ISIDRO DE LULES</Text>
          </View>

          <Text style={styles.title}>Lules Alerta</Text>
          <Text style={styles.subtitle}>
            Portal ciudadano de seguridad, reportes urbanos y emergencias comunales
          </Text>
        </View>

        {/* TARJETA DEL FORMULARIO */}
        <View style={styles.formCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardHeaderTitle}>Iniciar Sesión</Text>
              <Text style={styles.cardHeaderSubtitle}>Ingresa con tu documento de identidad</Text>
            </View>
            <View style={styles.cardHeaderIconBox}>
              <Ionicons name="shield-checkmark" size={20} color="#2A9D8F" />
            </View>
          </View>

          {/* CAMPO DNI */}
          <Text style={styles.fieldLabel}>DNI del Ciudadano</Text>
          <View style={[
            styles.inputContainer,
            focusedInput === 'dni' && styles.inputFocused,
            dniError ? styles.inputErrorBorder : null
          ]}>
            <Ionicons 
              name="card-outline" 
              size={20} 
              color={dniError ? "#DC2626" : (focusedInput === 'dni' ? "#264653" : "#64748B")} 
              style={styles.icon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Número de DNI (sin puntos)"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              maxLength={8}
              value={dni}
              onChangeText={handleDniChange}
              onFocus={() => setFocusedInput('dni')}
              onBlur={() => setFocusedInput(null)}
              editable={!isLoading}
            />
          </View>
          {dniError ? <Text style={styles.errorText}>{dniError}</Text> : null}

          {/* CAMPO CONTRASEÑA */}
          <Text style={styles.fieldLabel}>Contraseña de Acceso</Text>
          <View style={[
            styles.inputContainer,
            focusedInput === 'password' && styles.inputFocused,
            passwordError ? styles.inputErrorBorder : null,
            { marginBottom: passwordError ? 4 : 12 }
          ]}>
            <Ionicons 
              name="lock-closed-outline" 
              size={20} 
              color={passwordError ? "#DC2626" : (focusedInput === 'password' ? "#264653" : "#64748B")} 
              style={styles.icon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Tu contraseña personal"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={handlePasswordChange}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              editable={!isLoading}
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)} 
              style={styles.eyeIcon} 
              disabled={isLoading}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color="#64748B" 
              />
            </TouchableOpacity>
          </View>
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

          {/* OLVIDÉ CONTRASEÑA */}
          <TouchableOpacity
            style={styles.recoveryLink}
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={isLoading}
          >
            <Text style={styles.recoveryText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          {/* BOTÓN INGRESAR */}
          <TouchableOpacity 
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]} 
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnContent}>
                <Text style={styles.loginText}>INGRESAR AL SISTEMA</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* PIE / ENLACE DE REGISTRO */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerQuestion}>¿Primera vez en Lules Alerta?</Text>
          <TouchableOpacity 
            style={styles.registerPill}
            onPress={() => navigation.navigate('Register')} 
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={16} color="#264653" style={{ marginRight: 6 }} />
            <Text style={styles.registerPillText}>Crear una cuenta ciudadana</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F4F7F6' 
  },
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    paddingHorizontal: 22,
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 20, 
  },
  logoContainer: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  municipalityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4F1',
    borderWidth: 1,
    borderColor: '#C7E8E2',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 6,
  },
  municipalityText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#264653',
    letterSpacing: 0.8,
  },
  title: { 
    fontSize: 27, 
    fontWeight: '900', 
    color: '#1E293B', 
    letterSpacing: -0.5 
  },
  subtitle: { 
    fontSize: 13, 
    color: '#475569', 
    textAlign: 'center', 
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 16,
    fontWeight: '500',
  },
  formCard: { 
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#264653',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  cardHeaderSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  cardHeaderIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
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
    height: 52 
  },
  inputFocused: {
    borderColor: '#264653',
    backgroundColor: '#FFFFFF',
  },
  inputErrorBorder: { 
    borderColor: '#DC2626', 
    backgroundColor: '#FEF2F2',
    marginBottom: 4 
  }, 
  errorText: { 
    color: '#DC2626', 
    fontSize: 12, 
    marginBottom: 12, 
    marginLeft: 4, 
    fontWeight: '600' 
  }, 
  icon: { 
    marginRight: 10 
  },
  input: { 
    flex: 1, 
    fontSize: 15, 
    color: '#1E293B',
    fontWeight: '600',
  },
  eyeIcon: { 
    padding: 6 
  },
  recoveryLink: { 
    alignSelf: 'flex-end',
    marginBottom: 18,
    marginTop: 2,
  },
  recoveryText: { 
    color: '#264653', 
    fontSize: 13, 
    fontWeight: '700' 
  },
  loginBtn: { 
    backgroundColor: '#264653', 
    borderRadius: 14, 
    height: 52, 
    alignItems: 'center', 
    justifyContent: 'center', 
    shadowColor: '#264653', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 5,
  },
  loginBtnDisabled: { 
    backgroundColor: '#94A3B8', 
    shadowOpacity: 0 
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: { 
    color: '#FFFFFF', 
    fontSize: 15, 
    fontWeight: '800', 
    letterSpacing: 0.6 
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerQuestion: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '500',
  },
  registerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#264653',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  registerPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#264653',
  },
});
