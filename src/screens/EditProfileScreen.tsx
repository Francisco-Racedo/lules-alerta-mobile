import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, StyleSheet, TouchableOpacity, 
  Alert, ActivityIndicator, Keyboard 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export default function EditProfileScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [barrio, setBarrio] = useState('');
  
  const [contactoEmergenciaNombre, setContactoEmergenciaNombre] = useState('');
  const [contactoEmergenciaTelefono, setContactoEmergenciaTelefono] = useState('');
  const [datosMedicos, setDatosMedicos] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedData = await AsyncStorage.getItem('userData');
        if (storedData) {
          const user = JSON.parse(storedData);
          setUserId(user.id || '');
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

  // FILTROS ESTRICTOS: Eliminan caracteres invisibles y espacios que causaban el recorte visual
  const handleTelefonoChange = (text: string) => {
    setTelefono(text.replace(/[^0-9]/g, ''));
  };

  const handleContactoTelefonoChange = (text: string) => {
    setContactoEmergenciaTelefono(text.replace(/[^0-9]/g, ''));
  };

  const handleSave = async () => {
    Keyboard.dismiss(); 

    if (!nombre.trim() || !telefono || !email.trim() || !direccion.trim() || !barrio.trim()) {
      Alert.alert('Campos Incompletos', 'Por favor completa todos los campos obligatorios.');
      return;
    }

    setLoading(true);
    
    try {
      // AQUÍ DEBES PONER TU IP REAL (Ejemplo: http://192.168.1.15:3000/users/)
      const API_URL = `http://192.168.100.131:3000/users/${userId}`; 
      
      const response = await fetch(API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error('Fallo al actualizar en el servidor');
      }

      // LA SOLUCIÓN DEL DNI: 
      // Mezclamos cuidadosamente los datos nuevos con los existentes para jamás perder el DNI
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
          datosMedicos: datosMedicos.trim()
        };
        await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      }

      Alert.alert('¡Éxito!', 'Tu perfil ha sido actualizado correctamente.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

    } catch (error) {
      Alert.alert('Error', 'Hubo un problema al conectar con el servidor.');
      console.error(error);
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.sectionTitle}>Datos Personales (Obligatorios)</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Nombre Completo</Text>
          <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: Luis Racedo" />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Teléfono</Text>
          <TextInput style={styles.input} value={telefono} onChangeText={handleTelefonoChange} placeholder="Ej: 3816265505" keyboardType="phone-pad" maxLength={15} />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Correo Electrónico</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="ejemplo@correo.com" keyboardType="email-address" autoCapitalize="none" />
        </View>

        <Text style={styles.sectionTitle}>Ubicación (Obligatoria)</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Dirección</Text>
          <TextInput style={styles.input} value={direccion} onChangeText={setDireccion} placeholder="Calle y Número" />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Barrio</Text>
          <TextInput style={styles.input} value={barrio} onChangeText={setBarrio} placeholder="Ej: Centro" />
        </View>

        <Text style={styles.sectionTitle}>Emergencia / Médicos (Opcional)</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Contacto de Emergencia (Nombre)</Text>
          <TextInput style={styles.input} value={contactoEmergenciaNombre} onChangeText={setContactoEmergenciaNombre} placeholder="Ej: María (Madre)" />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Contacto de Emergencia (Teléfono)</Text>
          <TextInput style={styles.input} value={contactoEmergenciaTelefono} onChangeText={handleContactoTelefonoChange} placeholder="Teléfono del contacto" keyboardType="phone-pad" maxLength={15} />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Datos Médicos Relevantes</Text>
          <TextInput 
            style={[styles.input, styles.textArea]} 
            value={datosMedicos} 
            onChangeText={setDatosMedicos} 
            placeholder="Alergias, tipo de sangre, enfermedades crónicas..." 
            multiline 
            numberOfLines={3} 
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
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#E63946', marginTop: 15, marginBottom: 10, textTransform: 'uppercase' },
  inputContainer: { marginBottom: 15 },
  label: { fontSize: 14, color: '#666', marginBottom: 5, fontWeight: '500' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 15, height: 50, fontSize: 16, color: '#333' },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 10 },
  saveButton: { backgroundColor: '#E63946', borderRadius: 10, height: 55, justifyContent: 'center', marginTop: 20, elevation: 2, shadowColor: '#E63946', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  saveButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveIcon: { marginRight: 10 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});