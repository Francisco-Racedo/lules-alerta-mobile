import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { BASE_URL } from '../services/auth';

const MAX_IMAGES = 5;

const normalizeAddress = (address: string): string =>
  address
    .split(/\s+/)
    .filter((part, index, parts) => {
      const previousPart = parts[index - 1];
      return !previousPart || part.toLocaleLowerCase() !== previousPart.toLocaleLowerCase();
    })
    .join(' ')
    .trim();

type BeforeRemoveEvent = {
  data: { action: object };
  preventDefault: () => void;
};

type ReactNativeFormDataFile = {
  uri: string;
  name: string;
  type: string;
};

type ReactNativeFormData = FormData & {
  append(name: string, value: ReactNativeFormDataFile): void;
};

export default function ReportFormScreen({ route, navigation }: any) {
  const { category, location } = route.params || {};
  const insets = useSafeAreaInsets();

  const [description, setDescription] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedImages, setSelectedImages] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasUnsavedChanges = description.trim().length > 0 || selectedImages.length > 0;

  const getCategoryConfig = (categoryName?: string): {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    backgroundColor: string;
  } => {
    const normalized = (categoryName || '').trim().toLowerCase();
    if (normalized.includes('salud') || normalized.includes('médic') || normalized.includes('medic')) {
      return { icon: 'medkit', color: '#2A9D8F', backgroundColor: '#E6F7F5' };
    }
    if (normalized.includes('seguridad') || normalized.includes('polic') || normalized.includes('robo') || normalized.includes('sospecha')) {
      return { icon: 'shield-checkmark', color: '#1D70B8', backgroundColor: '#EBF3FC' };
    }
    if (normalized.includes('bombe') || normalized.includes('fuego') || normalized.includes('incendio')) {
      return { icon: 'flame', color: '#E76F51', backgroundColor: '#FEF4E8' };
    }
    if (normalized.includes('infraestructura') || normalized.includes('bache') || normalized.includes('calle') || normalized.includes('luz')) {
      return { icon: 'construct', color: '#8B572A', backgroundColor: '#F6EFEA' };
    }
    return { icon: 'alert-circle', color: '#E63946', backgroundColor: '#FEE4E2' };
  };

  const categoryConfig = getCategoryConfig(category);

  const returnToCategorySelector = (action: object) => {
    navigation.dispatch(action);
    setTimeout(() => {
      DeviceEventEmitter.emit('reopenCategoryModal');
    }, 0);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener(
      'beforeRemove',
      (event: BeforeRemoveEvent) => {
        if (isSubmitting) return;

        event.preventDefault();

        if (!hasUnsavedChanges) {
          returnToCategorySelector(event.data.action);
          return;
        }

        Alert.alert(
          'Salir del formulario',
          'Se perderán los datos y fotografías cargadas. ¿Deseas salir?',
          [
            { text: 'Continuar aquí', style: 'cancel' },
            {
              text: 'Salir',
              style: 'destructive',
              onPress: () => returnToCategorySelector(event.data.action),
            },
          ],
        );
      },
    );

    return unsubscribe;
  }, [hasUnsavedChanges, isSubmitting, navigation]);

  const lat = location?.coords?.latitude ?? location?.latitude;
  const lng = location?.coords?.longitude ?? location?.longitude;
  const addressText = location?.address || 'Ubicación GPS actual';

  const getCurrentAddress = async (
    latitude: number,
    longitude: number,
  ): Promise<string> => {
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (!place) return addressText;

      const street = place.street || place.name;
      const address = [street, place.streetNumber, place.city]
        .filter(Boolean)
        .join(' ');

      return normalizeAddress(address || addressText);
    } catch (error) {
      console.warn('No se pudo obtener la dirección del reporte:', error);
      return addressText;
    }
  };

  const handlePickImage = async () => {
    const remainingSlots = MAX_IMAGES - selectedImages.length;

    if (remainingSlots <= 0) {
      Toast.show({ type: 'error', text1: 'Límite alcanzado', text2: `Puedes adjuntar hasta ${MAX_IMAGES} fotografías.`, position: 'top' });
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Toast.show({ type: 'error', text1: 'Permiso denegado', text2: 'Se requiere acceso a la galería.', position: 'top' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      allowsEditing: false,
      quality: 0.5,
    });

    if (result.canceled || result.assets.length === 0) return;

    const availableAssets = result.assets.slice(0, remainingSlots);

    setSelectedImages((currentImages) => {
      const currentUris = new Set(currentImages.map((currentImage) => currentImage.uri));
      const newAssets = availableAssets.filter((asset) => !currentUris.has(asset.uri));
      return [...currentImages, ...newAssets].slice(0, MAX_IMAGES);
    });

    if (result.assets.length > remainingSlots) {
      Toast.show({ type: 'info', text1: 'Límite de imágenes', text2: `Solo se agregaron ${remainingSlots} imágenes.`, position: 'top' });
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((currentImages) => currentImages.filter((_, imageIndex) => imageIndex !== index));
  };

  const getFileName = (asset: ImagePicker.ImagePickerAsset, index: number) => {
    if (asset.fileName) return asset.fileName;
    const extension = asset.mimeType?.split('/')[1] || 'jpg';
    return `evidencia-${index + 1}.${extension}`;
  };

  const getMimeType = (asset: ImagePicker.ImagePickerAsset) => asset.mimeType || 'image/jpeg';

  const uploadReport = (formData: ReactNativeFormData, token: string): Promise<{ status: number; body: string }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}/alerts`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.timeout = 120000;

      xhr.onload = () => {
        const body = xhr.responseText || '';
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ status: xhr.status, body });
          return;
        }
        reject(new Error(`El servidor respondió con estado ${xhr.status}: ${body}`));
      };
      xhr.onerror = () => reject(new Error('No se pudo establecer conexión con el servidor'));
      xhr.ontimeout = () => reject(new Error('La solicitud excedió el tiempo máximo de espera'));
      xhr.onabort = () => reject(new Error('La solicitud fue cancelada'));

      xhr.send(formData);
    });
  };

  const handleSubmitReport = async () => {
    if (!description.trim()) {
      Toast.show({ type: 'error', text1: 'Campo obligatorio', text2: 'Por favor, escribe detalles importantes sobre el suceso.', position: 'top' });
      return;
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      Toast.show({ type: 'error', text1: 'Ubicación no disponible', text2: 'Activa el GPS para enviar el reporte.', position: 'top' });
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('No se encontró sesión de usuario');

      const formData = new FormData() as ReactNativeFormData;
      formData.append('category', category || 'General');
      formData.append('description', description.trim());
      formData.append('latitude', String(lat));
      formData.append('longitude', String(lng));
      formData.append('address', await getCurrentAddress(lat, lng));

      selectedImages.forEach((asset, index) => {
        const imageFile: ReactNativeFormDataFile = {
          uri: asset.uri,
          name: getFileName(asset, index),
          type: getMimeType(asset),
        };
        formData.append('files', imageFile);
      });

      await uploadReport(formData, token);

      Toast.show({ type: 'success', text1: 'Reporte enviado', text2: 'La alerta ha sido registrada por las autoridades.', position: 'top' });
      navigation.goBack();
    } catch (error) {
      console.error('Fallo al enviar reporte:', error);
      Toast.show({ type: 'error', text1: 'Error de red', text2: 'No se pudo enviar el reporte. Intenta de nuevo.', position: 'top' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40, paddingTop: 16 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.categoryHeaderCard, { backgroundColor: categoryConfig.backgroundColor }]}>
          <View style={[styles.categoryIconCircle, { backgroundColor: '#fff' }]}>
            <Ionicons name={categoryConfig.icon} size={28} color={categoryConfig.color} />
          </View>
          <View style={styles.categoryTextWrapper}>
            <Text style={[styles.categorySubtitle, { color: categoryConfig.color }]}>Categoría Seleccionada</Text>
            <Text style={[styles.categoryTitle, { color: categoryConfig.color }]}>{category || 'General'}</Text>
          </View>
        </View>

        <View style={styles.civicCard}>
          <View style={styles.civicRow}>
            <View style={styles.civicIconBox}>
              <Ionicons name="location-outline" size={22} color="#1D70B8" />
            </View>
            <View style={styles.civicTextContent}>
              <Text style={styles.civicLabel}>Ubicación del incidente</Text>
              <Text style={styles.civicValue} numberOfLines={2}>{addressText}</Text>
              <Text style={styles.coordText}>GPS: {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.civicCard}>
          <View style={styles.civicRowHeader}>
            <Ionicons name="document-text-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
            <Text style={styles.civicLabel}>Detalles del suceso</Text>
          </View>
          <TextInput
            style={[styles.textInput, isFocused && styles.textInputFocused]}
            placeholder="Describe qué está sucediendo. ¿Hay heridos? ¿Es urgente?..."
            placeholderTextColor="#94A3B8"
            multiline
            value={description}
            onChangeText={setDescription}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </View>

        <View style={styles.civicCard}>
          <View style={styles.evidenceHeader}>
            <View style={styles.civicRowHeader}>
              <Ionicons name="camera-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
              <Text style={styles.civicLabel}>Evidencia (Opcional)</Text>
            </View>
            <View style={styles.imageCounterBadge}>
              <Text style={styles.imageCounterText}>{selectedImages.length} / {MAX_IMAGES}</Text>
            </View>
          </View>

          {selectedImages.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageList}>
              {selectedImages.map((asset, index) => (
                <View key={`${asset.uri}-${index}`} style={styles.imagePreviewContainer}>
                  <Image source={{ uri: asset.uri }} style={styles.previewImage} />
                  <View style={styles.imageOverlay}>
                    <Text style={styles.imageIndexText}>{index + 1}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => handleRemoveImage(index)}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[
              styles.uploadDropzone,
              selectedImages.length >= MAX_IMAGES && styles.uploadDropzoneDisabled,
            ]}
            onPress={handlePickImage}
            disabled={isSubmitting || selectedImages.length >= MAX_IMAGES}
            activeOpacity={0.7}
          >
            <Ionicons
              name={selectedImages.length >= MAX_IMAGES ? 'checkmark-circle' : 'cloud-upload-outline'}
              size={32}
              color={selectedImages.length >= MAX_IMAGES ? '#10B981' : '#64748B'}
              style={{ marginBottom: 8 }}
            />
            <Text style={styles.uploadDropzoneText}>
              {selectedImages.length >= MAX_IMAGES
                ? 'Límite máximo de fotos alcanzado'
                : selectedImages.length === 0
                  ? 'Toca para seleccionar fotografías'
                  : 'Toca para agregar otra fotografía'}
            </Text>
            <Text style={styles.uploadDropzoneHint}>
              Formatos soportados: JPG, PNG
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmitReport}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.submitContent}>
              <Text style={styles.submitButtonText}>ENVIAR REPORTE OFICIAL</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={styles.submitIcon} />
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  content: {
    padding: 16,
  },

  categoryHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  categoryIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryTextWrapper: {
    marginLeft: 16,
    flex: 1,
  },
  categorySubtitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.5,
  },

  civicCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#ECEFF1', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.03, 
    shadowRadius: 6, 
    elevation: 1 
  },
  civicRow: { flexDirection: 'row', alignItems: 'flex-start' },
  civicRowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  civicIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F7FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  civicTextContent: { flex: 1, justifyContent: 'center' },
  civicLabel: { fontSize: 13, color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  civicValue: { fontSize: 15, color: '#1E293B', fontWeight: '600', lineHeight: 22 },
  coordText: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    color: '#1A1D20',
    fontSize: 15,
    lineHeight: 22,
  },
  textInputFocused: {
    borderColor: '#1D70B8',
    backgroundColor: '#fff',
    shadowColor: '#1D70B8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  evidenceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  imageCounterBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 12 },
  imageCounterText: { color: '#475569', fontSize: 12, fontWeight: '800' },
  
  imageList: { paddingBottom: 16, paddingTop: 4 },
  imagePreviewContainer: { position: 'relative', marginRight: 12, borderRadius: 12, overflow: 'hidden' },
  previewImage: { width: 100, height: 100, borderRadius: 12, backgroundColor: '#E2E8F0' },
  imageOverlay: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(15, 23, 42, 0.7)', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  imageIndexText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  removeImageButton: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(220, 38, 38, 0.9)', borderRadius: 12 },

  uploadDropzone: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 20,
  },
  uploadDropzoneDisabled: { borderColor: '#E2E8F0', backgroundColor: '#F1F5F9' },
  uploadDropzoneText: { color: '#475569', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  uploadDropzoneHint: { color: '#94A3B8', fontSize: 12, marginTop: 6, textAlign: 'center' },

  submitButton: {
    backgroundColor: '#E63946',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
    marginBottom: 20,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  submitIcon: { marginLeft: 8 },
});