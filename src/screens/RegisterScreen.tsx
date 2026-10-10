import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ScrollView, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RegisterScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Estados de error visuales
  const [errores, setErrores] = useState({ nombre: '', dni: '', telefono: '', password: '' });

  const handleNombreChange = (text: string) => {
    const cleanText = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    setNombre(cleanText);
    if (errores.nombre) setErrores({ ...errores, nombre: '' });
  };

  const handleDniChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setDni(numericValue);
    if (errores.dni) setErrores({ ...errores, dni: '' });
  };

  const handleTelefonoChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setTelefono(numericValue);
    if (errores.telefono) setErrores({ ...errores, telefono: '' });
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (errores.password) setErrores({ ...errores, password: '' });
  };

  const handleRegister = () => {
    let isValid = true;
    let nuevosErrores = { nombre: '', dni: '', telefono: '', password: '' };

    if (!nombre.trim()) { nuevosErrores.nombre = 'El nombre es obligatorio.'; isValid = false; }
    
    if (!dni) { nuevosErrores.dni = 'El DNI es obligatorio.'; isValid = false; }
    else if (dni.length < 7) { nuevosErrores.dni = 'Debe tener al menos 7 dígitos.'; isValid = false; }

    if (!telefono) { nuevosErrores.telefono = 'El teléfono es obligatorio.'; isValid = false; }
    else if (telefono.length < 10) { nuevosErrores.telefono = 'Ingresa un número válido con código de área.'; isValid = false; }

    if (!password) { nuevosErrores.password = 'La contraseña es obligatoria.'; isValid = false; }
    else if (password.length < 6) { nuevosErrores.password = 'Debe tener al menos 6 caracteres.'; isValid = false; }

    setErrores(nuevosErrores);

    if (!isValid) return;
    
    Alert.alert('Registro Exitoso', 'Tu cuenta ha sido creada. Ahora puedes iniciar sesión.', [
      { text: 'Ir al Login', onPress: () => navigation.goBack() }
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f8f9fa' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView 
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 60 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Crear Cuenta</Text>
          <Text style={styles.subtitle}>Completa tus datos reales. Esta información será vital en caso de una emergencia.</Text>
        </View>

        <View style={styles.formContainer}>
          
          <Text style={styles.label}>Nombre Completo</Text>
          <View style={[styles.inputContainer, errores.nombre ? styles.inputErrorBorder : null, { marginBottom: errores.nombre ? 4 : 20 }]}>
            <Ionicons name="person-outline" size={20} color={errores.nombre ? "#E63946" : "#666"} style={styles.icon} />
            <TextInput style={styles.input} placeholder="Ej: Juan Pérez" maxLength={50} value={nombre} onChangeText={handleNombreChange} />
          </View>
          {errores.nombre ? <Text style={styles.errorText}>{errores.nombre}</Text> : null}

          <Text style={styles.label}>DNI (Sin puntos)</Text>
          <View style={[styles.inputContainer, errores.dni ? styles.inputErrorBorder : null, { marginBottom: errores.dni ? 4 : 20 }]}>
            <Ionicons name="card-outline" size={20} color={errores.dni ? "#E63946" : "#666"} style={styles.icon} />
            <TextInput style={styles.input} placeholder="Ej: 35123456" keyboardType="numeric" maxLength={8} value={dni} onChangeText={handleDniChange} />
          </View>
          {errores.dni ? <Text style={styles.errorText}>{errores.dni}</Text> : null}

          <Text style={styles.label}>Teléfono Móvil (Sin guiones)</Text>
          <View style={[styles.inputContainer, errores.telefono ? styles.inputErrorBorder : null, { marginBottom: errores.telefono ? 4 : 20 }]}>
            <Ionicons name="call-outline" size={20} color={errores.telefono ? "#E63946" : "#666"} style={styles.icon} />
            <TextInput style={styles.input} placeholder="Ej: 3811234567" keyboardType="numeric" maxLength={15} value={telefono} onChangeText={handleTelefonoChange} />
          </View>
          {errores.telefono ? <Text style={styles.errorText}>{errores.telefono}</Text> : null}

          <Text style={styles.label}>Contraseña</Text>
          <View style={[styles.inputContainer, errores.password ? styles.inputErrorBorder : null, { marginBottom: errores.password ? 4 : 20 }]}>
            <Ionicons name="lock-closed-outline" size={20} color={errores.password ? "#E63946" : "#666"} style={styles.icon} />
            <TextInput style={styles.input} placeholder="Mínimo 6 caracteres" secureTextEntry={!showPassword} maxLength={30} value={password} onChangeText={handlePasswordChange} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#666" />
            </TouchableOpacity>
          </View>
          {errores.password ? <Text style={styles.errorText}>{errores.password}</Text> : null}

          <TouchableOpacity style={styles.registerBtn} onPress={handleRegister}>
            <Text style={styles.registerText}>CREAR MI CUENTA</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 25 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 10 },
  header: { marginBottom: 30 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 5, lineHeight: 20 },
  formContainer: { flex: 1 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#444', marginBottom: 8, marginLeft: 5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 15, marginBottom: 20, borderWidth: 1, borderColor: '#ddd', height: 55 },
  inputErrorBorder: { borderColor: '#E63946', borderWidth: 1.5 },
  errorText: { color: '#E63946', fontSize: 12, marginBottom: 15, marginLeft: 5, fontWeight: '600' },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#333' },
  eyeIcon: { padding: 5 },
  registerBtn: { backgroundColor: '#333', borderRadius: 10, height: 55, alignItems: 'center', justifyContent: 'center', marginTop: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  registerText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
});