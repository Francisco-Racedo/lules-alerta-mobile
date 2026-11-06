import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, StyleSheet, TouchableOpacity, 
  Alert, ActivityIndicator, Keyboard, Image, Modal, FlatList 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Toast from 'react-native-toast-message';
import { BASE_URL, getAssetUrl } from '../services/auth';

const BARRIOS_LULES = [
  'Centro',
  'Barrio Pilar',
  'La Reducción',
  'El Manantial',
  'Mercedes',
  'San Rafael',
  'Las Tipas',
  'Villa del Carmen',
  '25 de Mayo',
  '9 de Julio',
  'Belgrano',
  'San Martín',
  'La Quebrada',
];

type EditProfileNavigation = {
  goBack: () => void;
};

export default function EditProfileScreen({ navigation }: { navigation: EditProfileNavigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [barrio, setBarrio] = useState('');
  
  const [contactoEmergenciaNombre, setContactoEmergenciaNombre] = useState('');
  const [contactoEmergenciaTelefono, setContactoEmergenciaTelefono] = useState('');
  const [datosMedicos, setDatosMedicos] = useState('');

  const [barrioModalVisible, setBarrioModalVisible] = useState(false);
  const [searchBarrio, setSearchBarrio] = useState('');

  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedData = await AsyncStorage.getItem('userData');
        if (storedData) {
          const user = JSON.parse(storedData);
          setUserId(user.id || '');
          setFotoPerfil(user.fotoPerfil || null);
          setNombre(user.nombre || '');
          setTelefono(user.telefono || '');
          setEmail(user.email || '');
          setDireccion(user.direccion || '');
          setBarrio(user.barrio || '');
          setContactoEmergenciaNombre(user.contactoEmergenciaNombre || '');
          setContactoEmergenciaTelefono(user.contactoEmergenciaTelefono || '');
          setDatosMedicos(user.datosMedicos || '');
        }
      } catch (error) {
        console.error('Error cargando datos:', error);
      }
    };
    loadData();
  }, []);

  // --- FILTROS DE VALIDACIÓN EN TIEMPO REAL ---
  const handleNombreChange = (text: string) => {
    setNombre(text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ''));
  };

  const handleContactoNombreChange = (text: string) => {
    setContactoEmergenciaNombre(text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ''));
  };

  const handleTelefonoChange = (text: string) => {
    setTelefono(text.replace(/[^0-9]/g, ''));
  };

  const handleContactoTelefonoChange = (text: string) => {
    setContactoEmergenciaTelefono(text.replace(/[^0-9]/g, ''));
  };
  // --------------------------------------------

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Denegado', 'Se requiere acceso a la galería para subir una foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], 
      allowsEditing: true,
      aspect: [1, 1], 
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setFotoPerfil(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    Keyboard.dismiss(); 

    // --- VALIDACIONES DE ENVÍO ---
    if (!nombre.trim() || !telefono || !email.trim() || !direccion.trim() || !barrio.trim()) {
      Toast.show({ type: 'error', text1: 'Campos Incompletos', text2: 'Por favor completa todos los campos obligatorios.', position: 'top' });
      return;
    }

    // Validar formato de correo electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Toast.show({ type: 'error', text1: 'Correo Inválido', text2: 'Por favor ingresa un correo electrónico válido.', position: 'top' });
      return;
    }

    // Validar longitud de teléfonos (mínimo 10 dígitos)
    if (telefono.length < 10) {
      Toast.show({ type: 'error', text1: 'Teléfono Inválido', text2: 'Tu número de teléfono debe tener al menos 10 dígitos.', position: 'top' });
      return;
    }

    // Validar teléfono de emergencia solo si se ingresó algo
    if (contactoEmergenciaTelefono && contactoEmergenciaTelefono.length < 10) {
      Toast.show({ type: 'error', text1: 'Teléfono de Emergencia', text2: 'El número debe tener al menos 10 dígitos.', position: 'top' });
      return;
    }
    // -----------------------------

    setLoading(true);
    
    try {
      const API_URL = `${BASE_URL}/users/${userId}`; 
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        throw new Error('La sesión expiró. Inicia sesión nuevamente.');
      }
      
      const response = await fetch(API_URL, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre: nombre.trim(), 
          telefono, 
          email: email.trim(), 
          direccion: direccion.trim(), 
          barrio: barrio.trim(),
          contactoEmergenciaNombre: contactoEmergenciaNombre.trim(), 
          contactoEmergenciaTelefono, 
          datosMedicos: datosMedicos.trim()
        })
      });

      if (!response.ok) {
        let message = 'No se pudieron guardar los datos del perfil.';
        try {
          const errorData: unknown = await response.json();
          if (
            errorData &&
            typeof errorData === 'object' &&
            'message' in errorData
          ) {
            const serverMessage = (errorData as { message?: unknown }).message;
            if (typeof serverMessage === 'string') {
              message = serverMessage;
            } else if (Array.isArray(serverMessage)) {
              message = serverMessage.join('\n');
            }
          }
        } catch {
          // Conserva el mensaje genérico si el servidor no devuelve JSON.
        }
        throw new Error(message);
      }

      let finalAvatarUrl = null;

      if (fotoPerfil && fotoPerfil.startsWith('file')) {
        const filename = fotoPerfil.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        const uploadResult = await FileSystem.uploadAsync(`${API_URL}/avatar`, fotoPerfil, {
          httpMethod: 'PATCH',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: type,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (uploadResult.status >= 200 && uploadResult.status < 300) {
          const avatarData = JSON.parse(uploadResult.body);
          finalAvatarUrl = avatarData.fotoPerfil;
        } else {
          console.warn('La fotografía no se pudo subir. Status:', uploadResult.status);
        }
      }

      const storedData = await AsyncStorage.getItem('userData');
      if (storedData) {
        const user = JSON.parse(storedData);
        const updatedUser = {
          ...user, 
          nombre: nombre.trim(), 
          telefono, 
          email: email.trim(), 
          direccion: direccion.trim(), 
          barrio: barrio.trim(), 
          contactoEmergenciaNombre: contactoEmergenciaNombre.trim(), 
          contactoEmergenciaTelefono, 
          datosMedicos: datosMedicos.trim(),
          fotoPerfil: finalAvatarUrl || user.fotoPerfil
        };
        await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      }

      Toast.show({
        type: 'success',
        text1: '¡Éxito!',
        text2: 'Tu perfil ha sido actualizado correctamente.',
        position: 'top'
      });
      
      setTimeout(() => navigation.goBack(), 1500);

    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error de Conexión',
        text2:
          error instanceof Error
            ? error.message
            : 'Hubo un problema al conectar con el servidor.',
        position: 'top'
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderAvatarSource = () => {
    if (!fotoPerfil) return undefined; 
    if (fotoPerfil.startsWith('file')) return { uri: fotoPerfil };
    return { uri: getAssetUrl(fotoPerfil) };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Volver atrás"
        >
          <Ionicons name="arrow-back" size={24} color="#1A1D20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Perfil</Text>
        <View style={styles.spacer} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 44, 60) }
        ]}
        enableOnAndroid={true}
        extraScrollHeight={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* HERO CARD DE AVATAR */}
        <View style={styles.heroCard}>
          <TouchableOpacity style={styles.avatarButton} onPress={pickImage} activeOpacity={0.85}>
            <View style={styles.avatarRing}>
              {fotoPerfil ? (
                <Image source={renderAvatarSource()} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person" size={44} color="#264653" />
                </View>
              )}
            </View>
            <View style={styles.editIconBadge}>
              <Ionicons name="camera" size={15} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={styles.heroInfo}>
            <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark" size={13} color="#10B981" />
              <Text style={styles.heroBadgeText}>Identidad Ciudadana</Text>
            </View>
            <Text style={styles.heroName} numberOfLines={1}>
              {nombre.trim() || 'Mi Perfil'}
            </Text>
            <TouchableOpacity onPress={pickImage} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={styles.avatarChangeText}>
                <Ionicons name="camera-outline" size={13} color="#10B981" /> Toca para cambiar foto
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TARJETA 1: DATOS PERSONALES */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIconBox, styles.personalIconBox]}>
              <Ionicons name="person" size={16} color="#1D70B8" />
            </View>
            <Text style={styles.cardTitle}>Datos Personales</Text>
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredBadgeText}>Obligatorio</Text>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nombre Completo</Text>
            <View style={[styles.inputBox, focusedInput === 'nombre' && styles.inputFocused]}>
              <View style={[styles.inputIconBox, focusedInput === 'nombre' && styles.inputIconBoxFocused]}>
                <Ionicons name="person-outline" size={18} color={focusedInput === 'nombre' ? '#1D70B8' : '#64748B'} />
              </View>
              <TextInput 
                style={styles.input} 
                value={nombre} 
                onChangeText={handleNombreChange} 
                placeholder="Ej: Luis Racedo" 
                placeholderTextColor="#94A3B8"
                maxLength={50}
                onFocus={() => setFocusedInput('nombre')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Teléfono</Text>
            <View style={[styles.inputBox, focusedInput === 'telefono' && styles.inputFocused]}>
              <View style={[styles.inputIconBox, focusedInput === 'telefono' && styles.inputIconBoxFocused]}>
                <Ionicons name="call-outline" size={18} color={focusedInput === 'telefono' ? '#1D70B8' : '#64748B'} />
              </View>
              <TextInput 
                style={styles.input} 
                value={telefono} 
                onChangeText={handleTelefonoChange} 
                placeholder="Ej: 3816265505" 
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad" 
                maxLength={15} 
                onFocus={() => setFocusedInput('telefono')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>

          <View style={[styles.inputContainer, { marginBottom: 0 }]}>
            <Text style={styles.label}>Correo Electrónico</Text>
            <View style={[styles.inputBox, focusedInput === 'email' && styles.inputFocused]}>
              <View style={[styles.inputIconBox, focusedInput === 'email' && styles.inputIconBoxFocused]}>
                <Ionicons name="mail-outline" size={18} color={focusedInput === 'email' ? '#1D70B8' : '#64748B'} />
              </View>
              <TextInput 
                style={styles.input} 
                value={email} 
                onChangeText={setEmail} 
                placeholder="ejemplo@correo.com" 
                placeholderTextColor="#94A3B8"
                keyboardType="email-address" 
                autoCapitalize="none" 
                maxLength={100}
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>
        </View>

        {/* TARJETA 2: UBICACIÓN */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIconBox, styles.locationIconBox]}>
              <Ionicons name="location" size={16} color="#0284C7" />
            </View>
            <Text style={styles.cardTitle}>Ubicación</Text>
            <View style={[styles.requiredBadge, styles.locationBadge]}>
              <Text style={[styles.requiredBadgeText, styles.locationBadgeText]}>Obligatorio</Text>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Dirección</Text>
            <View style={[styles.inputBox, focusedInput === 'direccion' && styles.inputFocused]}>
              <View style={[styles.inputIconBox, focusedInput === 'direccion' && styles.inputIconBoxFocused]}>
                <Ionicons name="location-outline" size={18} color={focusedInput === 'direccion' ? '#0284C7' : '#64748B'} />
              </View>
              <TextInput 
                style={styles.input} 
                value={direccion} 
                onChangeText={setDireccion} 
                placeholder="Calle y Número (Ej: 9 de Julio 350)" 
                placeholderTextColor="#94A3B8"
                maxLength={200} 
                onFocus={() => setFocusedInput('direccion')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>

          <View style={[styles.inputContainer, { marginBottom: 0 }]}>
            <Text style={styles.label}>Barrio o Zona</Text>
            <TouchableOpacity 
              style={[styles.inputBox, styles.selectorBox, focusedInput === 'barrio' && styles.inputFocused]}
              onPress={() => {
                Keyboard.dismiss();
                setBarrioModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.inputIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="navigate-outline" size={18} color="#0284C7" />
              </View>
              <Text style={[styles.selectorText, !barrio && styles.placeholderText]}>
                {barrio || 'Selecciona tu barrio en Lules'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#0284C7" />
            </TouchableOpacity>
          </View>
        </View>

        {/* TARJETA 3: EMERGENCIA Y SALUD */}
        <View style={[styles.card, styles.emergencyCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIconBox, styles.emergencyIconBox]}>
              <Ionicons name="medkit" size={16} color="#DC2626" />
            </View>
            <Text style={[styles.cardTitle, styles.emergencyCardTitle]}>Emergencia y Salud</Text>
            <View style={styles.emergencyBadge}>
              <Text style={styles.emergencyBadgeText}>Prioridad Médica</Text>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Contacto de Emergencia (Nombre)</Text>
            <View style={[styles.inputBox, focusedInput === 'contactoEmergenciaNombre' && styles.inputEmergencyFocused]}>
              <View style={[styles.inputIconBox, styles.emergencyInputIconBox]}>
                <Ionicons name="person-outline" size={18} color="#DC2626" />
              </View>
              <TextInput 
                style={styles.input} 
                value={contactoEmergenciaNombre} 
                onChangeText={handleContactoNombreChange} 
                placeholder="Ej: María (Madre)" 
                placeholderTextColor="#94A3B8"
                maxLength={50}
                onFocus={() => setFocusedInput('contactoEmergenciaNombre')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Contacto de Emergencia (Teléfono)</Text>
            <View style={[styles.inputBox, focusedInput === 'contactoEmergenciaTelefono' && styles.inputEmergencyFocused]}>
              <View style={[styles.inputIconBox, styles.emergencyInputIconBox]}>
                <Ionicons name="call-outline" size={18} color="#DC2626" />
              </View>
              <TextInput 
                style={styles.input} 
                value={contactoEmergenciaTelefono} 
                onChangeText={handleContactoTelefonoChange} 
                placeholder="Teléfono para emergencias" 
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad" 
                maxLength={15} 
                onFocus={() => setFocusedInput('contactoEmergenciaTelefono')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>

          <View style={[styles.inputContainer, { marginBottom: 0 }]}>
            <Text style={styles.label}>Ficha Médica Relevante</Text>
            <View style={[styles.inputBox, styles.textAreaBox, focusedInput === 'datosMedicos' && styles.inputEmergencyFocused]}>
              <View style={[styles.inputIconBox, styles.emergencyInputIconBox, { marginTop: 10 }]}>
                <Ionicons name="medkit-outline" size={18} color="#DC2626" />
              </View>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                value={datosMedicos} 
                onChangeText={setDatosMedicos} 
                placeholder="Alergias, tipo de sangre, medicación crónica..." 
                placeholderTextColor="#94A3B8"
                multiline 
                numberOfLines={3} 
                onFocus={() => setFocusedInput('datosMedicos')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>
        </View>

        {/* BOTÓN GUARDAR */}
        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
          onPress={handleSave} 
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={styles.saveButtonContent}>
              <Ionicons name="save-outline" size={20} color="#fff" style={styles.saveIcon} />
              <Text style={styles.saveButtonText}>GUARDAR CAMBIOS</Text>
            </View>
          )}
        </TouchableOpacity>

      </KeyboardAwareScrollView>

      <Modal
        visible={barrioModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBarrioModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom + 20, 32) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Barrio o Zona</Text>
              <TouchableOpacity onPress={() => setBarrioModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Ionicons name="search-outline" size={18} color="#64748B" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Buscar barrio en Lules..."
                placeholderTextColor="#64748B"
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

            <FlatList
              data={BARRIOS_LULES.filter(b => b.toLowerCase().includes(searchBarrio.toLowerCase()))}
              keyExtractor={(item) => item}
              contentContainerStyle={{ paddingBottom: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.barrioOption}
                  onPress={() => {
                    setBarrio(item);
                    setBarrioModalVisible(false);
                    setSearchBarrio('');
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons 
                    name={barrio === item ? 'radio-button-on' : 'radio-button-off'} 
                    size={20} 
                    color={barrio === item ? '#1D70B8' : '#94A3B8'} 
                  />
                  <Text style={[styles.barrioOptionText, barrio === item && styles.barrioOptionTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1A1D20', letterSpacing: -0.3 },
  spacer: { width: 40 },
  scrollContent: { padding: 16, flexGrow: 1 },
  
  // HERO AVATAR CARD
  heroCard: {
    backgroundColor: '#264653',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F3843',
    shadowColor: '#264653',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarButton: {
    position: 'relative',
    marginRight: 16,
  },
  avatarRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    padding: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: '#fff' },
  avatarFallback: { 
    width: 76, 
    height: 76, 
    borderRadius: 38, 
    backgroundColor: '#E9F5F4', 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editIconBadge: { 
    position: 'absolute', 
    bottom: -2, 
    right: -2, 
    backgroundColor: '#10B981', 
    width: 30, 
    height: 30, 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 2.5, 
    borderColor: '#264653',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  heroInfo: { flex: 1 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
    gap: 5,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '800', color: '#A7F3D0', letterSpacing: 0.2 },
  heroName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  avatarChangeText: { fontSize: 12, color: '#A7F3D0', fontWeight: '700', marginTop: 5 },

  // CARD SECTIONS
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  personalIconBox: { backgroundColor: '#EBF3FC' },
  locationIconBox: { backgroundColor: '#E0F2FE' },
  emergencyIconBox: { backgroundColor: '#FEE2E2' },
  cardTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requiredBadge: { 
    backgroundColor: '#EBF3FC', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 8 
  },
  requiredBadgeText: { color: '#1D70B8', fontSize: 11, fontWeight: '700' },
  locationBadge: { backgroundColor: '#E0F2FE' },
  locationBadgeText: { color: '#0284C7' },

  // EMERGENCY CARD ACCENTS
  emergencyCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFAFA',
  },
  emergencyCardTitle: {
    color: '#991B1B',
  },
  emergencyBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  emergencyBadgeText: { color: '#DC2626', fontSize: 11, fontWeight: '700' },

  // INPUTS
  inputContainer: { marginBottom: 14 },
  label: { fontSize: 13, color: '#475569', marginBottom: 6, fontWeight: '700', paddingLeft: 2 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    minHeight: 50,
  },
  inputIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  inputIconBoxFocused: {
    backgroundColor: '#EBF3FC',
  },
  emergencyInputIconBox: {
    backgroundColor: '#FEE2E2',
  },
  input: { 
    flex: 1, 
    fontSize: 15, 
    color: '#1E293B',
    paddingVertical: 10,
  },
  inputFocused: { 
    borderColor: '#1D70B8', 
    borderWidth: 1.5,
    backgroundColor: '#fff',
    shadowColor: '#1D70B8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  inputEmergencyFocused: {
    borderColor: '#DC2626',
    borderWidth: 1.5,
    backgroundColor: '#fff',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  selectorBox: {
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  selectorText: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#94A3B8',
  },
  textAreaBox: {
    alignItems: 'flex-start',
    minHeight: 90,
  },
  textArea: { 
    minHeight: 80, 
    textAlignVertical: 'top', 
    paddingTop: 10 
  },
  
  // BOTÓN GUARDAR
  saveButton: { 
    backgroundColor: '#1D70B8', 
    borderRadius: 14, 
    height: 54, 
    justifyContent: 'center', 
    marginTop: 6, 
    marginBottom: 16,
    elevation: 3, 
    shadowColor: '#1D70B8', 
    shadowOffset: { width: 0, height: 3 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 5 
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveIcon: { marginRight: 8 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

  // MODAL DE BARRIOS
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B', letterSpacing: -0.2 },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 14,
  },
  modalSearchInput: {
    flex: 1,
    color: '#1E293B',
    fontSize: 14,
    marginHorizontal: 8,
    paddingVertical: 8,
  },
  barrioOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  barrioOptionText: { fontSize: 15, color: '#334155', marginLeft: 12, fontWeight: '500' },
  barrioOptionTextActive: { color: '#1D70B8', fontWeight: '800' },
});