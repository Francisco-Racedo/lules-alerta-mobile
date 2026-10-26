import React, { useState, useEffect, useLayoutEffect } from 'react';
import { 
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, 
  DeviceEventEmitter, TextInput, Image, ScrollView, Alert, KeyboardAvoidingView, Platform 
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import Toast from 'react-native-toast-message';

export default function ReportFormScreen({ route, navigation }: any) {
  const { category, location } = route.params || {};
  const insets = useSafeAreaInsets();
  const [address, setAddress] = useState<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState<boolean>(true);
  const [description, setDescription] = useState<string>('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Estado para rastrear si la caja de texto está activa
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            navigation.goBack();
            setTimeout(() => {
              DeviceEventEmitter.emit('reopenCategoryModal');
            }, 300);
          }}
          style={{ marginLeft: 0, marginRight: 20, padding: 5 }}
        >
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    (async () => {
      if (location?.coords) {
        try {
          const geocode = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          });

          if (geocode.length > 0) {
            const place = geocode[0];
            const streetName = place.street || 'Calle sin nombre';
            const streetNumber = place.streetNumber ? ` ${place.streetNumber}` : '';
            const city = place.city ? `, ${place.city}` : '';
            setAddress(`${streetName}${streetNumber}${city}`);
          } else {
            setAddress('Dirección no encontrada');
          }
        } catch (error) {
          setAddress('Error al obtener la dirección');
        } finally {
          setLoadingAddress(false);
        }
      }
    })();
  }, [location]);

  const handleAddPhoto = () => {
    Alert.alert(
      "Adjuntar evidencia",
      "¿De dónde deseas obtener la imagen?",
      [
        { text: "Tomar Foto", onPress: openCamera },
        { text: "Elegir de Galería", onPress: openGallery },
        { text: "Cancelar", style: "cancel" }
      ]
    );
  };

  const openCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permiso denegado", "Necesitamos acceso a tu cámara para esta función.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5, 
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], 
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const removePhoto = () => {
    setImageUri(null);
  };

  // --- LÓGICA DE ENVÍO SÚPER OPTIMIZADA ---
  const handleSubmit = async () => {
    if (!description.trim() && !imageUri) {
      Toast.show({ type: 'error', text1: 'Atención', text2: 'Agrega una descripción o una foto de la incidencia.', position: 'top' });
      return;
    }

    setIsSubmitting(true);

    try {
      const storedData = await AsyncStorage.getItem('userData');
      if (!storedData) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Sesión no encontrada. Por favor inicia sesión nuevamente.', position: 'top' });
        setIsSubmitting(false);
        return;
      }
      const user = JSON.parse(storedData);
      const BASE_URL = 'http://192.168.100.131:3000'; 
      
      const cleanAddress = (address && address !== 'Dirección no encontrada' && address !== 'Error al obtener la dirección') ? address : '';

      if (imageUri) {
        const filename = imageUri.split('/').pop() || 'evidencia.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        await FileSystem.uploadAsync(`${BASE_URL}/alerts`, imageUri, {
          httpMethod: 'POST',
          uploadType: 1 as any, 
          fieldName: 'file',
          mimeType: type,
          parameters: {
            category: category,
            description: description.trim(),
            latitude: String(location.coords.latitude),
            longitude: String(location.coords.longitude),
            userId: user.id,
            address: cleanAddress,
          }
        });

      } else {
        const response = await fetch(`${BASE_URL}/alerts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category,
            description: description.trim(),
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            userId: user.id,
            address: cleanAddress,
          })
        });

        if (!response.ok) {
          throw new Error('Error al registrar alerta en el servidor');
        }
      }

      Toast.show({
        type: 'success',
        text1: '¡Reporte Enviado!',
        text2: 'Tu alerta ha sido registrada y derivada.',
        position: 'top'
      });
      
      setTimeout(() => {
        navigation.goBack();
      }, 1500);

    } catch (error) {
      console.error('Error enviando reporte:', error);
      Toast.show({
        type: 'error',
        text1: 'Error de Conexión',
        text2: 'No pudimos enviar tu reporte. Revisa tu internet.',
        position: 'top'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Incidencia: {category}</Text>
        
        <View style={styles.gpsBox}>
          <Text style={styles.gpsTitle}>📍 Ubicación del incidente:</Text>
          {loadingAddress ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#E63946" />
              <Text style={styles.loadingText}>Traduciendo coordenadas...</Text>
            </View>
          ) : (
            <Text style={styles.addressText}>{address}</Text>
          )}
          <View style={styles.rawCoordsContainer}>
            <Text style={styles.coordText}>Lat: {location?.coords?.latitude}</Text>
            <Text style={styles.coordText}>Lng: {location?.coords?.longitude}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Descripción del suceso:</Text>
        <TextInput
          style={[styles.textInput, focusedInput === 'description' && styles.inputFocused]}
          placeholder="Escribe detalles importantes aquí..."
          multiline={true}
          numberOfLines={4}
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
          editable={!isSubmitting}
          onFocus={() => setFocusedInput('description')}
          onBlur={() => setFocusedInput(null)}
        />

        <Text style={styles.sectionLabel}>Evidencia Fotográfica:</Text>
        {imageUri ? (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.removeImageBtn} onPress={removePhoto} disabled={isSubmitting}>
              <Ionicons name="trash" size={20} color="white" />
              <Text style={styles.removeImageText}>Quitar Foto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto} disabled={isSubmitting}>
            <Ionicons name="camera" size={32} color="#E63946" />
            <Text style={styles.addPhotoText}>Añadir foto de lo ocurrido</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[styles.submitBtn, isSubmitting && { backgroundColor: '#666' }]} 
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>ENVIAR REPORTE</Text>
              <Ionicons name="send" size={20} color="white" style={{ marginLeft: 10 }} />
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa' },
  title: { fontSize: 24, fontWeight: '900', color: '#E63946', marginBottom: 20 },
  gpsBox: { backgroundColor: '#fff', padding: 15, borderRadius: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, marginBottom: 25 },
  gpsTitle: { fontWeight: 'bold', color: '#333', marginBottom: 10, fontSize: 16 },
  addressText: { fontSize: 18, color: '#111', fontWeight: '600', marginBottom: 10 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  loadingText: { marginLeft: 10, color: '#666', fontStyle: 'italic' },
  rawCoordsContainer: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  coordText: { color: '#888', fontSize: 12, fontFamily: 'monospace' },
  sectionLabel: { fontSize: 16, fontWeight: 'bold', color: '#444', marginBottom: 8 },
  textInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 15, fontSize: 16, minHeight: 120, marginBottom: 25, color: '#333' },
  inputFocused: { borderColor: '#E63946', borderWidth: 2, backgroundColor: '#fffafa' },
  addPhotoBtn: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#E63946', borderStyle: 'dashed', borderRadius: 10, padding: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  addPhotoText: { color: '#E63946', fontWeight: 'bold', marginTop: 10, fontSize: 16 },
  imagePreviewContainer: { marginBottom: 30, alignItems: 'center' },
  imagePreview: { width: '100%', height: 200, borderRadius: 10, marginBottom: 10 },
  removeImageBtn: { flexDirection: 'row', backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, alignItems: 'center' },
  removeImageText: { color: 'white', marginLeft: 5, fontWeight: 'bold' },
  submitBtn: { backgroundColor: '#E63946', flexDirection: 'row', padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#E63946', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 5, elevation: 5 },
  submitBtnText: { color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
});