import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, StyleSheet, TouchableOpacity, 
  Alert, ActivityIndicator, Keyboard, Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Toast from 'react-native-toast-message';
import { BASE_URL } from '../services/auth';

export default function EditProfileScreen({ navigation }: any) {
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

  // Variable de estado para rastrear el input activo movida al nivel superior
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
    return { uri: `${BASE_URL}${fotoPerfil}` };
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Perfil</Text>
        <View style={styles.spacer} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        enableOnAndroid={true}
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarContainer}>
          <TouchableOpacity style={styles.avatarButton} onPress={pickImage}>
            {fotoPerfil ? (
              <Image source={renderAvatarSource()} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person-circle-outline" size={100} color="#ccc" />
            )}
            <View style={styles.editIconBadge}>
              <Ionicons name="camera" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Toca para cambiar foto</Text>
        </View>

        <Text style={styles.sectionTitle}>Datos Personales (Obligatorios)</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Nombre Completo</Text>
          <TextInput 
            style={[styles.input, focusedInput === 'nombre' && styles.inputFocused]} 
            value={nombre} 
            onChangeText={handleNombreChange} 
            placeholder="Ej: Luis Racedo" 
            maxLength={50}
            onFocus={() => setFocusedInput('nombre')}
            onBlur={() => setFocusedInput(null)}
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Teléfono</Text>
          <TextInput 
            style={[styles.input, focusedInput === 'telefono' && styles.inputFocused]} 
            value={telefono} 
            onChangeText={handleTelefonoChange} 
            placeholder="Ej: 3816265505" 
            keyboardType="phone-pad" 
            maxLength={15} 
            onFocus={() => setFocusedInput('telefono')}
            onBlur={() => setFocusedInput(null)}
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Correo Electrónico</Text>
          <TextInput 
            style={[styles.input, focusedInput === 'email' && styles.inputFocused]} 
            value={email} 
            onChangeText={setEmail} 
            placeholder="ejemplo@correo.com" 
            keyboardType="email-address" 
            autoCapitalize="none" 
            maxLength={100}
            onFocus={() => setFocusedInput('email')}
            onBlur={() => setFocusedInput(null)}
          />
        </View>

        <Text style={styles.sectionTitle}>Ubicación (Obligatoria)</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Dirección</Text>
          <TextInput 
            style={[styles.input, focusedInput === 'direccion' && styles.inputFocused]} 
            value={direccion} 
            onChangeText={setDireccion} 
            placeholder="Calle y Número" 
            maxLength={200} 
            onFocus={() => setFocusedInput('direccion')}
            onBlur={() => setFocusedInput(null)}
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Barrio</Text>
          <TextInput 
            style={[styles.input, focusedInput === 'barrio' && styles.inputFocused]} 
            value={barrio} 
            onChangeText={setBarrio} 
            placeholder="Ej: Centro" 
            maxLength={100} 
            onFocus={() => setFocusedInput('barrio')}
            onBlur={() => setFocusedInput(null)}
          />
        </View>

        <Text style={styles.sectionTitle}>Emergencia / Médicos (Opcional)</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Contacto de Emergencia (Nombre)</Text>
          <TextInput 
            style={[styles.input, focusedInput === 'contactoEmergenciaNombre' && styles.inputFocused]} 
            value={contactoEmergenciaNombre} 
            onChangeText={handleContactoNombreChange} 
            placeholder="Ej: María (Madre)" 
            maxLength={50}
            onFocus={() => setFocusedInput('contactoEmergenciaNombre')}
            onBlur={() => setFocusedInput(null)}
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Contacto de Emergencia (Teléfono)</Text>
          <TextInput 
            style={[styles.input, focusedInput === 'contactoEmergenciaTelefono' && styles.inputFocused]} 
            value={contactoEmergenciaTelefono} 
            onChangeText={handleContactoTelefonoChange} 
            placeholder="Teléfono del contacto" 
            keyboardType="phone-pad" 
            maxLength={15} 
            onFocus={() => setFocusedInput('contactoEmergenciaTelefono')}
            onBlur={() => setFocusedInput(null)}
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Datos Médicos Relevantes</Text>
          <TextInput 
            style={[styles.input, styles.textArea, focusedInput === 'datosMedicos' && styles.inputFocused]} 
            value={datosMedicos} 
            onChangeText={setDatosMedicos} 
            placeholder="Alergias, tipo de sangre, enfermedades crónicas..." 
            multiline 
            numberOfLines={3} 
            onFocus={() => setFocusedInput('datosMedicos')}
            onBlur={() => setFocusedInput(null)}
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.saveButtonContent}>
              <Ionicons name="save-outline" size={24} color="#fff" style={styles.saveIcon} />
              <Text style={styles.saveButtonText}>GUARDAR CAMBIOS</Text>
            </View>
          )}
        </TouchableOpacity>

      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15, backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  spacer: { width: 34 },
  scrollContent: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  avatarContainer: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
  avatarButton: { position: 'relative', width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  editIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#E63946', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarHint: { marginTop: 10, fontSize: 13, color: '#666', fontWeight: '500' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#E63946', marginTop: 15, marginBottom: 10, textTransform: 'uppercase' },
  inputContainer: { marginBottom: 15 },
  label: { fontSize: 14, color: '#666', marginBottom: 5, fontWeight: '500' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 15, height: 50, fontSize: 16, color: '#333' },
  inputFocused: { 
    borderColor: '#E63946', 
    borderWidth: 2,
    backgroundColor: '#fffafa'
  },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 10 },
  saveButton: { backgroundColor: '#E63946', borderRadius: 10, height: 55, justifyContent: 'center', marginTop: 20, elevation: 2, shadowColor: '#E63946', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  saveButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveIcon: { marginRight: 10 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});