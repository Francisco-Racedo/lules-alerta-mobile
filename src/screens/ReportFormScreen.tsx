import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';

const MAX_IMAGES = 5;
const BASE_URL = 'http://192.168.100.131:3000';

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
  const [selectedImages, setSelectedImages] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lat = location?.coords?.latitude || location?.latitude || -26.9358;
  const lng = location?.coords?.longitude || location?.longitude || -65.3288;
  const addressText =
    location?.address || 'Av. Ramón B. Ortega 1048, Lules';

  const handlePickImage = async () => {
  const remainingSlots = MAX_IMAGES - selectedImages.length;

  if (remainingSlots <= 0) {
    Toast.show({
      type: 'error',
      text1: 'Límite alcanzado',
      text2: `Puedes adjuntar hasta ${MAX_IMAGES} fotografías.`,
    });
    return;
  }

  const permissionResult =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permissionResult.granted) {
    Toast.show({
      type: 'error',
      text1: 'Permiso denegado',
      text2: 'Se requiere acceso a la galería.',
    });
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: remainingSlots,
    allowsEditing: false,
    quality: 0.5,
  });

  if (result.canceled || result.assets.length === 0) {
    return;
  }

  const availableAssets = result.assets.slice(0, remainingSlots);

  setSelectedImages((currentImages) => {
    const currentUris = new Set(
      currentImages.map((currentImage) => currentImage.uri),
    );

    const newAssets = availableAssets.filter(
      (asset) => !currentUris.has(asset.uri),
    );

    return [...currentImages, ...newAssets].slice(0, MAX_IMAGES);
  });

  if (result.assets.length > remainingSlots) {
    Toast.show({
      type: 'info',
      text1: 'Límite de imágenes',
      text2: `Solo se agregaron ${remainingSlots} imágenes.`,
    });
  }
};

  const handleRemoveImage = (index: number) => {
    setSelectedImages((currentImages) =>
      currentImages.filter((_, imageIndex) => imageIndex !== index),
    );
  };

  const getFileName = (
    asset: ImagePicker.ImagePickerAsset,
    index: number,
  ) => {
    if (asset.fileName) {
      return asset.fileName;
    }

    const extension = asset.mimeType?.split('/')[1] || 'jpg';
    return `evidencia-${index + 1}.${extension}`;
  };

  const getMimeType = (asset: ImagePicker.ImagePickerAsset) => {
    return asset.mimeType || 'image/jpeg';
  };

  const uploadReport = (
  formData: ReactNativeFormData,
): Promise<{ status: number; body: string }> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', `${BASE_URL}/alerts`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.timeout = 120000;

    xhr.onload = () => {
      const body = xhr.responseText || '';

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          status: xhr.status,
          body,
        });
        return;
      }

      reject(
        new Error(
          `El servidor respondió con estado ${xhr.status}: ${body}`,
        ),
      );
    };

    xhr.onerror = () => {
      reject(new Error('No se pudo establecer conexión con el servidor'));
    };

    xhr.ontimeout = () => {
      reject(new Error('La solicitud excedió el tiempo máximo de espera'));
    };

    xhr.onabort = () => {
      reject(new Error('La solicitud fue cancelada'));
    };

    xhr.send(formData);
  });
};

  const handleSubmitReport = async () => {
  if (!description.trim()) {
    Toast.show({
      type: 'error',
      text1: 'Campo obligatorio',
      text2: 'Por favor, escribe detalles importantes.',
    });
    return;
  }

  setIsSubmitting(true);

  try {
    const storedData = await AsyncStorage.getItem('userData');

    if (!storedData) {
      throw new Error('No se encontró sesión de usuario');
    }

    const user = JSON.parse(storedData);

    if (!user?.id) {
      throw new Error(
        'La sesión no contiene un identificador de usuario válido',
      );
    }

    const formData = new FormData() as ReactNativeFormData;

    formData.append('category', category || 'General');
    formData.append('description', description.trim());
    formData.append('latitude', String(lat));
    formData.append('longitude', String(lng));
    formData.append('userId', String(user.id));
    formData.append('address', addressText);

    selectedImages.forEach((asset, index) => {
      const imageFile: ReactNativeFormDataFile = {
        uri: asset.uri,
        name: getFileName(asset, index),
        type: getMimeType(asset),
      };

      formData.append('files', imageFile);
    });

    await uploadReport(formData);

    Toast.show({
      type: 'success',
      text1: 'Reporte enviado',
      text2: 'La alerta fue emitida con éxito.',
    });

    navigation.goBack();
  } catch (error) {
    console.error('Fallo al enviar reporte:', error);

    Toast.show({
      type: 'error',
      text1: 'Error de red',
      text2: 'No se pudo enviar el reporte. Intenta de nuevo.',
    });
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <SafeAreaView
      style={styles.container}
      edges={['bottom', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.mainTitle}>
          Incidencia:{' '}
          <Text style={styles.categoryTitle}>
            {category || 'General'}
          </Text>
        </Text>

        <View style={styles.infoCard}>
          <View style={styles.locationHeader}>
            <Ionicons
              name="location"
              size={20}
              color="#E63946"
              style={styles.locationIcon}
            />
            <Text style={styles.label}>Ubicación del incidente:</Text>
          </View>

          <Text style={styles.addressValue}>{addressText}</Text>

          <View style={styles.coordsContainer}>
            <Text style={styles.coordText}>
              Lat: {Number(lat).toFixed(6)}
            </Text>
            <Text style={styles.coordText}>
              Lng: {Number(lng).toFixed(6)}
            </Text>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Descripción del suceso:</Text>

          <TextInput
            style={styles.textInput}
            placeholder="Escribe detalles importantes aquí..."
            placeholderTextColor="#999"
            multiline
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.evidenceHeader}>
            <Text style={styles.label}>Evidencia fotográfica:</Text>

            <Text style={styles.imageCounter}>
              {selectedImages.length}/{MAX_IMAGES}
            </Text>
          </View>

          {selectedImages.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imageList}
            >
              {selectedImages.map((asset, index) => (
                <View
                  key={`${asset.uri}-${index}`}
                  style={styles.imagePreviewContainer}
                >
                  <Image
                    source={{ uri: asset.uri }}
                    style={styles.previewImage}
                  />

                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => handleRemoveImage(index)}
                    disabled={isSubmitting}
                    accessibilityLabel={`Eliminar fotografía ${index + 1}`}
                  >
                    <Ionicons
                      name="close-circle"
                      size={28}
                      color="#E63946"
                    />
                  </TouchableOpacity>

                  <View style={styles.imageIndexBadge}>
                    <Text style={styles.imageIndexText}>{index + 1}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[
              styles.uploadButton,
              selectedImages.length >= MAX_IMAGES &&
                styles.uploadButtonDisabled,
            ]}
            onPress={handlePickImage}
            disabled={
              isSubmitting || selectedImages.length >= MAX_IMAGES
            }
          >
            <Ionicons
              name={
                selectedImages.length >= MAX_IMAGES
                  ? 'checkmark-circle-outline'
                  : 'camera-outline'
              }
              size={32}
              color={
                selectedImages.length >= MAX_IMAGES
                  ? '#888'
                  : '#E63946'
              }
              style={styles.uploadIcon}
            />

            <Text
              style={[
                styles.uploadText,
                selectedImages.length >= MAX_IMAGES &&
                  styles.uploadTextDisabled,
              ]}
            >
              {selectedImages.length >= MAX_IMAGES
                ? 'Límite de 5 imágenes alcanzado'
                : selectedImages.length === 0
                  ? 'Añadir fotografías'
                  : 'Añadir otra fotografía'}
            </Text>

            <Text style={styles.uploadHint}>
              {selectedImages.length >= MAX_IMAGES
                ? 'Elimina una imagen para agregar otra'
                : `Puedes agregar hasta ${MAX_IMAGES} imágenes`}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            isSubmitting && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmitReport}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.submitContent}>
              <Text style={styles.submitButtonText}>ENVIAR REPORTE</Text>

              <Ionicons
                name="chevron-forward"
                size={18}
                color="#fff"
                style={styles.submitIcon}
              />
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
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 20,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  categoryTitle: {
    color: '#E63946',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#eee',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationIcon: {
    marginRight: 8,
  },
  label: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  addressValue: {
    fontSize: 16,
    color: '#222',
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 28,
  },
  coordsContainer: {
    flexDirection: 'row',
    marginLeft: 28,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 6,
  },
  coordText: {
    fontSize: 12,
    color: '#666',
    marginRight: 15,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  inputContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#eee',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    color: '#333',
    backgroundColor: '#fafafa',
    marginTop: 8,
  },
  evidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageCounter: {
    color: '#666',
    fontSize: 12,
    fontWeight: 'bold',
  },
  imageList: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginRight: 10,
  },
  previewImage: {
    width: 110,
    height: 110,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 15,
  },
  imageIndexBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  imageIndexText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#ffcccc',
    borderStyle: 'dashed',
    borderRadius: 12,
    minHeight: 130,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    marginTop: 8,
    paddingVertical: 20,
  },
  uploadButtonDisabled: {
    borderColor: '#ccc',
    backgroundColor: '#f2f2f2',
  },
  uploadIcon: {
    marginBottom: 5,
  },
  uploadText: {
    color: '#E63946',
    fontWeight: 'bold',
    marginTop: 5,
    textAlign: 'center',
  },
  uploadTextDisabled: {
    color: '#777',
  },
  uploadHint: {
    color: '#999',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#E63946',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  submitIcon: {
    marginLeft: 5,
  },
});