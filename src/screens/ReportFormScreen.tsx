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
const QUICK_HINTS = ['¿Hay heridos?', 'Tránsito cortado', 'Cables caídos', 'Urgente'];

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
    if (normalized.includes('infraestructura') || normalized.includes('servicio') || normalized.includes('bache') || normalized.includes('calle') || normalized.includes('luz')) {
      return { icon: 'construct', color: '#D97706', backgroundColor: '#FEF3C7' };
    }
    return { icon: 'alert-circle', color: '#1D70B8', backgroundColor: '#EBF3FC' };
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

  const handleAddHint = (hint: string) => {
    setDescription((prev) => {
      if (!prev.trim()) return `${hint}: `;
      if (prev.includes(hint)) return prev;
      return `${prev.trim()} · ${hint}: `;
    });
  };

  const handleTakePhoto = async () => {
    const remainingSlots = MAX_IMAGES - selectedImages.length;
    if (remainingSlots <= 0) {
      Toast.show({ type: 'error', text1: 'Límite alcanzado', text2: `Puedes adjuntar hasta ${MAX_IMAGES} fotografías.`, position: 'top' });
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permiso denegado', text2: 'Se requiere acceso a la cámara.', position: 'top' });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.6,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    setSelectedImages((currentImages) => [...currentImages, result.assets[0]].slice(0, MAX_IMAGES));
  };

  const handlePickGalleryImage = async () => {
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
      quality: 0.6,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const availableAssets = result.assets.slice(0, remainingSlots);
    setSelectedImages((currentImages) => {
      const currentUris = new Set(currentImages.map((img) => img.uri));
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
      {/* HEADER CÍVICO LIMPIO */}
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
        <Text style={styles.headerTitle}>Detalles del Reporte</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 44, 60) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* CATEGORÍA SELECCIONADA */}
        <View style={[styles.categoryHeaderCard, { backgroundColor: categoryConfig.backgroundColor, borderColor: categoryConfig.color + '33' }]}>
          <View style={[styles.categoryIconCircle, { backgroundColor: categoryConfig.color }]}>
            <Ionicons name={categoryConfig.icon} size={24} color="#fff" />
          </View>
          <View style={styles.categoryTextWrapper}>
            <Text style={[styles.categorySubtitle, { color: categoryConfig.color }]}>Área Municipal</Text>
            <Text style={[styles.categoryTitle, { color: categoryConfig.color }]}>{category || 'General'}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.changeCategoryBtn, { borderColor: categoryConfig.color + '40' }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.75}
          >
            <Ionicons name="sync-outline" size={14} color={categoryConfig.color} />
            <Text style={[styles.changeCategoryText, { color: categoryConfig.color }]}>Cambiar</Text>
          </TouchableOpacity>
        </View>

        {/* UBICACIÓN DEL INCIDENTE */}
        <View style={styles.civicCard}>
          <View style={styles.civicRowHeader}>
            <View style={styles.civicIconBox}>
              <Ionicons name="location-outline" size={18} color="#1D70B8" />
            </View>
            <Text style={styles.civicLabel}>Ubicación del incidente</Text>
          </View>
          <Text style={styles.civicValue} numberOfLines={2}>{addressText}</Text>
          <View style={styles.gpsPill}>
            <Ionicons name="navigate-circle" size={14} color="#10B981" />
            <Text style={styles.coordText}>GPS: {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</Text>
          </View>
        </View>

        {/* DETALLES DEL SUCESO */}
        <View style={styles.civicCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.civicRowHeader}>
              <View style={[styles.civicIconBox, styles.detailsIconBox]}>
                <Ionicons name="document-text-outline" size={18} color="#334155" />
              </View>
              <Text style={styles.civicLabel}>Detalles del suceso</Text>
            </View>
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredBadgeText}>Obligatorio</Text>
            </View>
          </View>

          {/* CHIPS RÁPIDOS DE SUGERENCIA */}
          <View style={styles.chipsRow}>
            {QUICK_HINTS.map((hint) => (
              <TouchableOpacity
                key={hint}
                style={styles.chipButton}
                onPress={() => handleAddHint(hint)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={13} color="#475569" />
                <Text style={styles.chipText}>{hint}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.textInput, isFocused && styles.textInputFocused]}
            placeholder="Describe qué está sucediendo, referencias de calles o personas involucradas..."
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={500}
            value={description}
            onChangeText={setDescription}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />

          <View style={styles.counterRow}>
            <Text style={styles.counterText}>{description.length} / 500 caracteres</Text>
          </View>
        </View>

        {/* EVIDENCIA FOTOGRÁFICA */}
        <View style={styles.civicCard}>
          <View style={styles.evidenceHeader}>
            <View style={styles.civicRowHeader}>
              <View style={[styles.civicIconBox, styles.cameraIconBox]}>
                <Ionicons name="camera-outline" size={18} color="#264653" />
              </View>
              <Text style={styles.civicLabel}>Evidencia Fotográfica</Text>
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
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close-circle" size={22} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {selectedImages.length < MAX_IMAGES ? (
            <View style={styles.photoActionsBox}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cameraActionBtn]}
                onPress={handleTakePhoto}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={19} color="#264653" />
                <Text style={styles.cameraActionBtnText}>Tomar Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.galleryActionBtn]}
                onPress={handlePickGalleryImage}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <Ionicons name="images" size={19} color="#059669" />
                <Text style={styles.galleryActionBtnText}>Galería</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.maxImagesReached}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={styles.maxImagesText}>Límite máximo de 5 fotografías alcanzado</Text>
            </View>
          )}
        </View>

        {/* BOTÓN ENVIAR REPORTE OFICIAL */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: categoryConfig.color, shadowColor: categoryConfig.color },
            isSubmitting && styles.submitButtonDisabled
          ]}
          onPress={handleSubmitReport}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={styles.submitContent}>
              <Ionicons name="send" size={18} color="#fff" style={styles.submitIcon} />
              <Text style={styles.submitButtonText}>ENVIAR REPORTE OFICIAL</Text>
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
    backgroundColor: '#F1F5F9',
  },
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
  content: {
    padding: 16,
    flexGrow: 1,
  },

  categoryHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  categoryTextWrapper: {
    marginLeft: 14,
    flex: 1,
  },
  categorySubtitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  changeCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#fff',
    gap: 4,
  },
  changeCategoryText: {
    fontSize: 12,
    fontWeight: '700',
  },

  civicCard: { 
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  civicRowHeader: { flexDirection: 'row', alignItems: 'center' },
  civicIconBox: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    backgroundColor: '#EBF3FC', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 10 
  },
  detailsIconBox: {
    backgroundColor: '#F1F5F9',
  },
  cameraIconBox: {
    backgroundColor: '#F0F7F6',
  },
  civicLabel: { 
    fontSize: 13, 
    color: '#334155', 
    fontWeight: '800', 
    textTransform: 'uppercase', 
    letterSpacing: 0.4,
  },
  requiredBadge: { 
    backgroundColor: '#FEF3C7', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 8 
  },
  requiredBadgeText: { color: '#B45309', fontSize: 11, fontWeight: '700' },
  
  civicValue: { 
    fontSize: 15, 
    color: '#1E293B', 
    fontWeight: '600', 
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 8,
  },
  gpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignSelf: 'flex-start',
    gap: 5,
  },
  coordText: { 
    fontSize: 11, 
    color: '#64748B', 
    fontWeight: '600', 
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // CHIPS
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 6,
    gap: 5,
  },
  chipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },

  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    minHeight: 110,
    textAlignVertical: 'top',
    color: '#1A1D20',
    fontSize: 15,
    lineHeight: 22,
  },
  textInputFocused: {
    borderColor: '#475569',
    borderWidth: 1.5,
    backgroundColor: '#fff',
    shadowColor: '#475569',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  counterRow: {
    alignItems: 'flex-end',
    marginTop: 6,
  },
  counterText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },

  evidenceHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  imageCounterBadge: { 
    backgroundColor: '#F1F5F9', 
    paddingHorizontal: 10, 
    paddingVertical: 3, 
    borderRadius: 8,
  },
  imageCounterText: { color: '#475569', fontSize: 11, fontWeight: '800' },
  
  imageList: { paddingBottom: 14, paddingTop: 4 },
  imagePreviewContainer: { position: 'relative', marginRight: 12, borderRadius: 12, overflow: 'hidden' },
  previewImage: { width: 92, height: 92, borderRadius: 12, backgroundColor: '#E2E8F0' },
  imageOverlay: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(15, 23, 42, 0.75)', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  imageIndexText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  removeImageButton: { 
    position: 'absolute', 
    top: 4, 
    right: 4, 
    backgroundColor: '#fff', 
    borderRadius: 12,
  },

  photoActionsBox: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.2,
    gap: 8,
  },
  cameraActionBtn: {
    backgroundColor: '#F0F7F6',
    borderColor: '#CBE5E2',
  },
  galleryActionBtn: {
    backgroundColor: '#E6F7F5',
    borderColor: '#C2EBE5',
  },
  cameraActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#264653',
  },
  galleryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  maxImagesReached: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 8,
  },
  maxImagesText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '700',
  },

  // BOTÓN ENVIAR
  submitButton: {
    backgroundColor: '#264653',
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 16,
    elevation: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  submitIcon: { marginRight: 8 },
});