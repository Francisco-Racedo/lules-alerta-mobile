import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ScrollView, Alert, Modal, FlatList, Keyboard, ActivityIndicator, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '../services/auth';
import { BARRIOS_LULES } from '../constants/lules';

export default function RegisterScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [barrio, setBarrio] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [barrioModalVisible, setBarrioModalVisible] = useState(false);
  const [searchBarrio, setSearchBarrio] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Estados de error visuales
  const [errores, setErrores] = useState({ 
    nombre: '', 
    dni: '', 
    telefono: '', 
    password: '' 
  });

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

  const handleRegister = async () => {
    Keyboard.dismiss();
    let isValid = true;
    let nuevosErrores = { nombre: '', dni: '', telefono: '', password: '' };

    if (!nombre.trim()) { 
      nuevosErrores.nombre = 'El nombre es obligatorio.'; 
      isValid = false; 
    }
    
    if (!dni) { 
      nuevosErrores.dni = 'El DNI es obligatorio.'; 
      isValid = false; 
    } else if (dni.length < 7) { 
      nuevosErrores.dni = 'Debe tener al menos 7 dígitos.'; 
      isValid = false; 
    }

    if (!telefono) { 
      nuevosErrores.telefono = 'El teléfono es obligatorio.'; 
      isValid = false; 
    } else if (telefono.length < 10) { 
      nuevosErrores.telefono = 'Ingresa un número válido con código de área.'; 
      isValid = false; 
    }

    if (!password) { 
      nuevosErrores.password = 'La contraseña es obligatoria.'; 
      isValid = false; 
    } else if (password.length < 6) { 
      nuevosErrores.password = 'Debe tener al menos 6 caracteres.'; 
      isValid = false; 
    }

    setErrores(nuevosErrores);

    if (!isValid) return;
    
    setIsLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          dni,
          telefono,
          password,
          ...(barrio ? { barrio } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = Array.isArray(data.message) 
          ? data.message.join('\n')
          : (data.message || 'Hubo un problema al crear la cuenta.');
          
        Alert.alert('Error de Registro', errorMessage);
        setIsLoading(false);
        return;
      }

      Alert.alert(
        '¡Registro Exitoso!', 
        'Tu cuenta ciudadana ha sido creada correctamente. Ahora puedes iniciar sesión con tu DNI.', 
        [{ text: 'INGRESAR', onPress: () => navigation.goBack() }]
      );

    } catch {
      Alert.alert(
        'Error de Conexión', 
        'No pudimos conectarnos con el servidor. Verifica tu conexión a internet.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBarrios = BARRIOS_LULES.filter(b => 
    b.toLowerCase().includes(searchBarrio.toLowerCase())
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent, 
          { 
            paddingTop: Math.max(insets.top + 12, 20), 
            paddingBottom: Math.max(insets.bottom + 36, 48) 
          }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* BOTÓN VOLVER ARRIBA A LA IZQUIERDA */}
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => navigation.goBack()} 
          disabled={isLoading}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Volver atrás"
        >
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>

        {/* ENCABEZADO CON LOGO OFICIAL CENTRADO */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/logo.png')} 
              style={styles.logoImage} 
              resizeMode="contain" 
            />
          </View>

          <View style={styles.badgeWrapper}>
            <Ionicons name="shield-checkmark" size={13} color="#2A9D8F" style={{ marginRight: 4 }} />
            <Text style={styles.badgeText}>ALTA CIUDADANA • SAN ISIDRO DE LULES</Text>
          </View>
          <Text style={styles.title}>Crear Cuenta</Text>
          <Text style={styles.subtitle}>
            Ingresa tus datos reales para la atención coordinada ante situaciones de emergencia.
          </Text>
        </View>

        {/* TARJETA DEL FORMULARIO */}
        <View style={styles.formCard}>
          {/* NOMBRE */}
          <Text style={styles.fieldLabel}>Nombre y Apellido</Text>
          <View style={[
            styles.inputContainer,
            focusedInput === 'nombre' && styles.inputFocused,
            errores.nombre ? styles.inputErrorBorder : null,
          ]}>
            <Ionicons 
              name="person-outline" 
              size={20} 
              color={errores.nombre ? "#DC2626" : (focusedInput === 'nombre' ? "#264653" : "#64748B")} 
              style={styles.icon} 
            />
            <TextInput 
              style={styles.input} 
              placeholder="Ej: Juan Carlos Pérez" 
              placeholderTextColor="#94A3B8"
              maxLength={50} 
              value={nombre} 
              onChangeText={handleNombreChange} 
              onFocus={() => setFocusedInput('nombre')}
              onBlur={() => setFocusedInput(null)}
              editable={!isLoading} 
            />
          </View>
          {errores.nombre ? <Text style={styles.errorText}>{errores.nombre}</Text> : null}

          {/* DNI */}
          <Text style={styles.fieldLabel}>DNI (Sin puntos)</Text>
          <View style={[
            styles.inputContainer,
            focusedInput === 'dni' && styles.inputFocused,
            errores.dni ? styles.inputErrorBorder : null,
          ]}>
            <Ionicons 
              name="card-outline" 
              size={20} 
              color={errores.dni ? "#DC2626" : (focusedInput === 'dni' ? "#264653" : "#64748B")} 
              style={styles.icon} 
            />
            <TextInput 
              style={styles.input} 
              placeholder="Ej: 38123456" 
              placeholderTextColor="#94A3B8"
              keyboardType="numeric" 
              maxLength={8} 
              value={dni} 
              onChangeText={handleDniChange} 
              onFocus={() => setFocusedInput('dni')}
              onBlur={() => setFocusedInput(null)}
              editable={!isLoading} 
            />
          </View>
          {errores.dni ? <Text style={styles.errorText}>{errores.dni}</Text> : null}

          {/* TELÉFONO */}
          <Text style={styles.fieldLabel}>Teléfono Móvil (Con código de área)</Text>
          <View style={[
            styles.inputContainer,
            focusedInput === 'telefono' && styles.inputFocused,
            errores.telefono ? styles.inputErrorBorder : null,
          ]}>
            <Ionicons 
              name="call-outline" 
              size={20} 
              color={errores.telefono ? "#DC2626" : (focusedInput === 'telefono' ? "#264653" : "#64748B")} 
              style={styles.icon} 
            />
            <TextInput 
              style={styles.input} 
              placeholder="Ej: 3814811234" 
              placeholderTextColor="#94A3B8"
              keyboardType="numeric" 
              maxLength={15} 
              value={telefono} 
              onChangeText={handleTelefonoChange} 
              onFocus={() => setFocusedInput('telefono')}
              onBlur={() => setFocusedInput(null)}
              editable={!isLoading} 
            />
          </View>
          {errores.telefono ? <Text style={styles.errorText}>{errores.telefono}</Text> : null}

          {/* BARRIO O ZONA (SELECTOR CON MODAL) */}
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>Barrio o Zona de Lules</Text>
            <View style={styles.optionalBadgeBox}>
              <Text style={styles.optionalBadgeText}>Recomendado</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={[
              styles.inputContainer,
              styles.selectorContainer,
              barrio ? styles.selectorSelected : null
            ]}
            onPress={() => {
              Keyboard.dismiss();
              setBarrioModalVisible(true);
            }}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Ionicons 
              name="navigate-outline" 
              size={20} 
              color={barrio ? "#2A9D8F" : "#64748B"} 
              style={styles.icon} 
            />
            <Text style={[styles.selectorText, !barrio && styles.placeholderText]} numberOfLines={1}>
              {barrio || 'Selecciona tu barrio de residencia'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#2A9D8F" />
          </TouchableOpacity>

          {/* CONTRASEÑA */}
          <Text style={styles.fieldLabel}>Contraseña</Text>
          <View style={[
            styles.inputContainer,
            focusedInput === 'password' && styles.inputFocused,
            errores.password ? styles.inputErrorBorder : null,
          ]}>
            <Ionicons 
              name="lock-closed-outline" 
              size={20} 
              color={errores.password ? "#DC2626" : (focusedInput === 'password' ? "#264653" : "#64748B")} 
              style={styles.icon} 
            />
            <TextInput 
              style={styles.input} 
              placeholder="Mínimo 6 caracteres" 
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPassword} 
              maxLength={30} 
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
          {errores.password ? <Text style={styles.errorText}>{errores.password}</Text> : null}

          {/* BOTÓN REGISTRARME */}
          <TouchableOpacity 
            style={[styles.registerBtn, isLoading && styles.registerBtnDisabled]} 
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnContent}>
                <Ionicons name="shield-checkmark" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.registerText}>CREAR MI CUENTA CIUDADANA</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ENLACE INICIAR SESIÓN */}
        <View style={styles.loginLinkContainer}>
          <Text style={styles.loginLinkPrompt}>¿Ya tienes una cuenta registrada?</Text>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.loginLinkAction}>Inicia sesión con tu DNI</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL OFICIAL SELECTOR DE BARRIOS DE LULES */}
      <Modal
        visible={barrioModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBarrioModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom + 20, 32) }]}>
            <View style={styles.modalDragger} />
            
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Barrios de San Isidro de Lules</Text>
                <Text style={styles.modalSubtitle}>Selecciona tu zona de residencia</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setBarrioModalVisible(false)} 
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* BUSCADOR DENTRO DEL MODAL */}
            <View style={styles.modalSearchBox}>
              <Ionicons name="search-outline" size={18} color="#2A9D8F" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Buscar barrio o zona..."
                placeholderTextColor="#94A3B8"
                value={searchBarrio}
                onChangeText={setSearchBarrio}
                autoCapitalize="words"
              />
              {searchBarrio.length > 0 ? (
                <TouchableOpacity onPress={() => setSearchBarrio('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* LISTADO DE BARRIOS */}
            <FlatList
              data={filteredBarrios}
              keyExtractor={(item) => item}
              contentContainerStyle={{ paddingBottom: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.barrioOption,
                    barrio === item && styles.barrioOptionActive
                  ]}
                  onPress={() => {
                    setBarrio(item);
                    setBarrioModalVisible(false);
                    setSearchBarrio('');
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[
                    styles.radioCircle,
                    barrio === item && styles.radioCircleActive
                  ]}>
                    {barrio === item ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={[
                    styles.barrioOptionText, 
                    barrio === item && styles.barrioOptionTextActive
                  ]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F4F7F6' 
  },
  scrollContent: { 
    flexGrow: 1, 
    paddingHorizontal: 22 
  },
  backBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#264653',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { 
    alignItems: 'center',
    marginBottom: 18 
  },
  logoContainer: {
    width: 105,
    height: 105,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4F1',
    borderWidth: 1,
    borderColor: '#C7E8E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#264653',
    letterSpacing: 0.6,
  },
  title: { 
    fontSize: 26, 
    fontWeight: '900', 
    color: '#1E293B',
    letterSpacing: -0.4,
  },
  subtitle: { 
    fontSize: 13, 
    color: '#475569', 
    marginTop: 4, 
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 10,
    fontWeight: '500',
  },
  formCard: { 
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#264653',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  fieldLabel: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#334155', 
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  optionalBadgeBox: {
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  optionalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2A9D8F',
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
    shadowColor: '#264653',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  selectorContainer: {
    justifyContent: 'space-between',
  },
  selectorSelected: {
    borderColor: '#C7E8E2',
    backgroundColor: '#F0FDF4',
  },
  selectorText: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  placeholderText: {
    color: '#94A3B8',
    fontWeight: '500',
  },
  registerBtn: { 
    backgroundColor: '#264653', 
    borderRadius: 14, 
    height: 52, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 8, 
    shadowColor: '#264653', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 5 
  },
  registerBtnDisabled: { 
    backgroundColor: '#94A3B8', 
    shadowOpacity: 0 
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerText: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '800', 
    letterSpacing: 0.5 
  },
  loginLinkContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loginLinkPrompt: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '500',
  },
  loginLinkAction: {
    fontSize: 14,
    color: '#264653',
    fontWeight: '800',
  },

  // ESTILOS MODAL BARRIOS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '75%',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalDragger: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1E293B',
  },
  barrioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
  },
  barrioOptionActive: {
    backgroundColor: '#E6F4F1',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioCircleActive: {
    borderColor: '#264653',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#264653',
  },
  barrioOptionText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '600',
  },
  barrioOptionTextActive: {
    color: '#264653',
    fontWeight: '800',
  },
});
