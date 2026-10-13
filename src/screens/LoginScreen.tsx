import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ScrollView, Keyboard, Alert, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen({ navigation }: any) {
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [dniError, setDniError] = useState('');
  const [passwordError, setPasswordError] = useState('');

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
    } else if (dni.length < 7) {
      setDniError('El DNI debe tener al menos 7 dígitos.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('La contraseña es obligatoria.');
      isValid = false;
    }

    if (!isValid) return; 

    setIsLoading(true);

    try {
      const response = await fetch('http://192.168.100.131:3000/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dni, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(
          'Error de Autenticación', 
          Array.isArray(data.message) ? data.message.join('\n') : (data.message || 'Credenciales incorrectas')
        );
        setIsLoading(false);
        return;
      }

      // Guardar el Token JWT y los datos del ciudadano en la memoria del teléfono
      await AsyncStorage.setItem('userToken', data.access_token);
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));

      // Redirección directa al mapa sin posibilidad de volver atrás con el botón nativo
      navigation.replace('MainTabs');

    } catch (error) {
      console.error(error);
      Alert.alert('Error de Conexión', 'No pudimos conectarnos con el servidor. Verifica tu red.');
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
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={80} color="#E63946" />
          <Text style={styles.title}>Lules Alerta</Text>
          <Text style={styles.subtitle}>Tu conexión directa con la seguridad y servicios municipales</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={[styles.inputContainer, dniError ? styles.inputErrorBorder : null]}>
            <Ionicons name="card-outline" size={20} color={dniError ? "#E63946" : "#666"} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Número de DNI"
              keyboardType="numeric"
              maxLength={8}
              value={dni}
              onChangeText={handleDniChange}
              editable={!isLoading}
            />
          </View>
          {dniError ? <Text style={styles.errorText}>{dniError}</Text> : null}

          <View style={[styles.inputContainer, passwordError ? styles.inputErrorBorder : null, { marginBottom: passwordError ? 0 : 15 }]}>
            <Ionicons name="lock-closed-outline" size={20} color={passwordError ? "#E63946" : "#666"} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={handlePasswordChange}
              editable={!isLoading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon} disabled={isLoading}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#666" />
            </TouchableOpacity>
          </View>
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

          <TouchableOpacity 
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]} 
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginText}>INGRESAR</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('Register')} disabled={isLoading}>
            <Text style={styles.registerText}>¿No tienes cuenta? <Text style={styles.registerTextBold}>Regístrate aquí</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 40 },
  header: { alignItems: 'center', marginBottom: 40, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#333', marginTop: 10, letterSpacing: 1 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 5 },
  formContainer: { paddingHorizontal: 30 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: '#ddd', height: 55 },
  inputErrorBorder: { borderColor: '#E63946', borderWidth: 1.5, marginBottom: 4 }, 
  errorText: { color: '#E63946', fontSize: 12, marginBottom: 15, marginLeft: 5, fontWeight: '600' }, 
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#333' },
  eyeIcon: { padding: 5 },
  loginBtn: { backgroundColor: '#E63946', borderRadius: 10, height: 55, alignItems: 'center', justifyContent: 'center', marginTop: 10, shadowColor: '#E63946', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  loginBtnDisabled: { backgroundColor: '#e57373', shadowOpacity: 0 },
  loginText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  registerLink: { marginTop: 20, alignItems: 'center' },
  registerText: { color: '#666', fontSize: 14 },
  registerTextBold: { color: '#E63946', fontWeight: 'bold' }
});