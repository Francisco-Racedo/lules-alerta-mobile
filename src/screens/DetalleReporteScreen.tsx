import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert as NativeAlert, TextInput, ActivityIndicator, Linking, Platform, Modal, ScrollView, Dimensions, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType } from 'expo-file-system/legacy';
import ImageViewer from 'react-native-image-zoom-viewer';
import { BASE_URL, getAssetUrl } from '../services/auth';
import type { ReportHistoryEvent, ReportItem, ReportStatus } from '../types/reports';

const { width: screenWidth } = Dimensions.get('window');
const REPORT_CHANGED_EVENT = 'reportChanged';
const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

const normalizeAddress = (address: string): string =>
  address
    .split(/\s+/)
    .filter((part, index, parts) => {
      const previousPart = parts[index - 1];
      return !previousPart || part.toLocaleLowerCase() !== previousPart.toLocaleLowerCase();
    })
    .join(' ')
    .trim();

type DetailRoute = {
  params: {
    report: ReportItem;
  };
};

type DetailNavigation = {
  goBack: () => void;
};

type TimelineItem =
  | { type: 'status'; event: ReportHistoryEvent; date: string }
  | { type: 'archived'; event: null; date: string };

export default function DetalleReporteScreen({
  route,
  navigation,
}: {
  route: DetailRoute;
  navigation: DetailNavigation;
}) {
  const { report } = route.params;
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState(report.description || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentDescription, setCurrentDescription] = useState(report.description || '');

  const initialImages = report.images?.length ? report.images : (report.imageUrl ? [report.imageUrl] : []);
  const [currentImages, setCurrentImages] = useState<string[]>(initialImages);
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);

  const resolutionImages = report.resolution?.images?.length 
    ? report.resolution.images 
    : (report.resolution?.imageUrl ? [report.resolution.imageUrl] : []);

  const [isModalVisible, setModalVisible] = useState(false);
  const [modalImages, setModalImages] = useState<{url: string}[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const isPending = report.status === 'PENDING';
  const isClosed = report.status === 'RESOLVED' || report.status === 'DISMISSED';

  const getCategoryConfig = (category?: string): {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    backgroundColor: string;
  } => {
    const normalized = (category || '').trim().toLowerCase();
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

  const categoryConfig = getCategoryConfig(report.category);

  const timelineEvents: TimelineItem[] = [
    ...(Array.isArray(report.history)
      ? report.history.map((event) => ({ type: 'status' as const, event, date: event.changedAt }))
      : []),
    ...(report.archivedAt
      ? [{ type: 'archived' as const, event: null, date: report.archivedAt }]
      : []),
  ].sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime());

  const getTimelineTitle = (event: ReportHistoryEvent) => getStatusText(event.newStatus);

  const getTimelineIcon = (status: ReportStatus): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'RESOLVED': return 'checkmark-circle';
      case 'DISMISSED': return 'close-circle';
      case 'IN_PROGRESS': return 'construct';
      default: return 'time';
    }
  };

  const handleUpdatePhoto = async (imageIndex: number) => {
    try {
      if (imageIndex < 0 || imageIndex >= currentImages.length) {
        Toast.show({ type: 'error', text1: 'Imagen inválida', text2: 'No se pudo determinar qué imagen reemplazar.', position: 'top' });
        return;
      }

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Toast.show({ type: 'error', text1: 'Permiso denegado', text2: 'Se requiere acceso a la galería.', position: 'top' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: false, allowsEditing: true, aspect: [4, 3], quality: 0.5,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      setIsProcessing(true);
      const imageUri = result.assets[0].uri;
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('La sesión no está disponible.');
      
      const filename = result.assets[0].fileName || imageUri.split('/').pop() || 'evidencia.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = result.assets[0].mimeType || (match ? `image/${match[1]}` : 'image/jpeg');

      const uploadResult = await FileSystem.uploadAsync(
        `${BASE_URL}/alerts/${report.id}/images/${imageIndex}`,
        imageUri,
        {
          httpMethod: 'PATCH', uploadType: FileSystemUploadType.MULTIPART, fieldName: 'file', mimeType: type,
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (uploadResult.status !== 200) throw new Error(`El servidor respondió con estado ${uploadResult.status}`);

      const updatedAlert = JSON.parse(uploadResult.body);
      const updatedImages = updatedAlert.images?.length ? updatedAlert.images : updatedAlert.imageUrl ? [updatedAlert.imageUrl] : [];

      setCurrentImages(updatedImages);
      DeviceEventEmitter.emit(REPORT_CHANGED_EVENT, report.id);
      Toast.show({ type: 'success', text1: 'Foto actualizada', text2: 'La imagen seleccionada fue reemplazada correctamente.', position: 'top' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo reemplazar la imagen.', position: 'top' });
    } finally {
      setIsProcessing(false);
    }
  };

  let mapCoords = null;
  if (report.location && report.location.coordinates && Array.isArray(report.location.coordinates)) {
    mapCoords = { latitude: Number(report.location.coordinates[1]), longitude: Number(report.location.coordinates[0]) };
  } else if (report.latitude && report.longitude) {
    mapCoords = { latitude: Number(report.latitude), longitude: Number(report.longitude) };
  }

  const handleOpenMaps = () => {
    if (!mapCoords) return;
    const lat = mapCoords.latitude;
    const lng = mapCoords.longitude;
    
    let rawLabel = report.category || 'Incidencia';
    if (currentDescription) {
      const shortDesc = currentDescription.length > 40 ? currentDescription.substring(0, 40) + '...' : currentDescription;
      rawLabel = `${rawLabel}: ${shortDesc}`;
    }
    const label = encodeURIComponent(rawLabel);
    
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`
    });

    if (url) {
      Linking.canOpenURL(url).then(supported => {
        if (supported) Linking.openURL(url);
        else Toast.show({ type: 'error', text1: 'Error', text2: 'No se encontró aplicación de mapas.' });
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return '#F59E0B'; // Ambar más moderno
      case 'IN_PROGRESS': return '#3B82F6'; // Azul vibrante
      case 'RESOLVED': return '#10B981'; // Verde esmeralda
      case 'DISMISSED': return '#EF4444'; // Rojo vivo
      default: return '#64748B';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Pendiente de Revisión';
      case 'IN_PROGRESS': return 'En Curso por Autoridades';
      case 'RESOLVED': return 'Incidencia Resuelta';
      case 'DISMISSED': return 'Reporte Descartado';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: ARGENTINA_TIME_ZONE };
    return new Date(dateString).toLocaleDateString('es-ES', options);
  };

  const formatShortDate = (dateString?: string) => {
    if (!dateString) return 'Fecha no disponible';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
    const dayMonth = date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      timeZone: ARGENTINA_TIME_ZONE,
    });
    const time = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: ARGENTINA_TIME_ZONE,
    });
    return `${dayMonth} · ${time} hs`;
  };

  const handleUpdateDescription = async () => {
    if (!editedDescription.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'La descripción no puede estar vacía.', position: 'top' });
      return;
    }
    setIsProcessing(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('La sesión no está disponible.');

      const response = await fetch(`${BASE_URL}/alerts/${report.id}/description`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: editedDescription.trim() })
      });
      if (!response.ok) throw new Error('Error al actualizar');
      setCurrentDescription(editedDescription.trim());
      setIsEditing(false);
      DeviceEventEmitter.emit(REPORT_CHANGED_EVENT, report.id);
      Toast.show({ type: 'success', text1: 'Actualizado', text2: 'La descripción fue guardada con éxito.', position: 'top' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error de Red', text2: 'No se pudo actualizar el reporte.', position: 'top' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = () => {
    NativeAlert.alert("Cancelar Reporte", "¿Estás seguro de que deseas eliminar este reporte de emergencia? Esta acción no se puede deshacer.", [
      { text: "No, mantener", style: "cancel" },
      { 
        text: "Sí, cancelar alerta", style: "destructive",
        onPress: async () => {
          setIsProcessing(true);
          try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) throw new Error('La sesión no está disponible.');

            const response = await fetch(`${BASE_URL}/alerts/${report.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            if (!response.ok) throw new Error('Error al eliminar');
            DeviceEventEmitter.emit(REPORT_CHANGED_EVENT, report.id);
            Toast.show({ type: 'success', text1: 'Cancelado', text2: 'El reporte fue eliminado correctamente.', position: 'top' });
            navigation.goBack();
          } catch (error) {
            Toast.show({ type: 'error', text1: 'Fallo al Eliminar', text2: 'Ocurrió un error de conexión.', position: 'top' });
            setIsProcessing(false);
          }
        }
      }
    ]);
  };

  const handleArchive = () => {
    NativeAlert.alert("Archivar Reporte", "¿Deseas ocultar este reporte de tu lista principal? Podrás mantener la limpieza de tus gestiones.", [
      { text: "Cancelar", style: "cancel" },
      { 
        text: "Sí, archivar", style: "default",
        onPress: async () => {
          setIsProcessing(true);
          try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) throw new Error('La sesión no está disponible.');

            const response = await fetch(`${BASE_URL}/alerts/${report.id}/archive`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
            if (!response.ok) throw new Error('Error al archivar');
            DeviceEventEmitter.emit(REPORT_CHANGED_EVENT, report.id);
            Toast.show({ type: 'success', text1: 'Archivado', text2: 'El reporte fue ocultado correctamente.', position: 'top' });
            navigation.goBack();
          } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo archivar el reporte.', position: 'top' });
            setIsProcessing(false);
          }
        }
      }
    ]);
  };

  const openGallery = (imagesArray: string[], startIndex: number) => {
    setModalImages(imagesArray.map((img) => ({ url: getAssetUrl(img) })));
    setCurrentImageIndex(startIndex);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          disabled={isProcessing}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Volver atrás"
        >
          <Ionicons name="arrow-back" size={24} color="#1A1D20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle del Reporte</Text>
        <View style={styles.spacer} />
      </View>

      <KeyboardAwareScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 48, 64) }
        ]}
        enableOnAndroid={true}
        extraScrollHeight={120} 
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.carouselContainer}>
          {currentImages.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const index = Math.round(offsetX / screenWidth);
                  setCurrentCarouselIndex(index);
                }}
              >
                {currentImages.map((img, idx) => (
                  <TouchableOpacity
                    key={`${img}-${idx}`}
                    activeOpacity={0.9}
                    onPress={() => openGallery(currentImages, idx)}
                    style={{ width: screenWidth, height: 320 }}
                  >
                    <Image source={{ uri: getAssetUrl(img) }} style={styles.fullImage} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {currentImages.length > 1 && (
                <View style={styles.paginationWrapper}>
                  <View style={styles.paginationPill}>
                    {currentImages.map((_, idx) => (
                      <View key={idx} style={[styles.dot, currentCarouselIndex === idx && styles.activeDot]} />
                    ))}
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noImageContainer}>
              <Ionicons name="image-outline" size={50} color="#94A3B8" />
              <Text style={styles.noImageText}>Sin evidencia fotográfica</Text>
            </View>
          )}
          
          {isPending && currentImages.length > 0 && (
            <TouchableOpacity 
              style={styles.changePhotoButton} 
              onPress={() => handleUpdatePhoto(currentCarouselIndex)} 
              disabled={isProcessing}
              activeOpacity={0.8}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={16} color="#fff" />
                  <Text style={styles.changePhotoText}>Actualizar Foto</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.content, { paddingBottom: Math.max(insets.bottom + 36, 48) }]}>
          <View style={styles.topRow}>
            <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.backgroundColor }]}>
              <Ionicons name={categoryConfig.icon} size={15} color={categoryConfig.color} />
              <Text style={[styles.categoryText, { color: categoryConfig.color }]} numberOfLines={1}>
                {report.category || 'General'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{getStatusText(report.status)}</Text>
            </View>
          </View>

          <View style={styles.civicCard}>
            <View style={styles.civicRow}>
              <View style={styles.civicIconBox}>
                <Ionicons name="calendar-outline" size={20} color="#64748B" />
              </View>
              <View style={styles.civicTextContent}>
                <Text style={styles.civicLabel}>Fecha de emisión</Text>
                <Text style={styles.civicValue}>{formatDate(report.createdAt)}</Text>
              </View>
            </View>
            <View style={styles.civicDivider} />
            <View style={styles.civicRow}>
              <View style={styles.civicIconBox}>
                <Ionicons name="location-outline" size={20} color="#64748B" />
              </View>
              <View style={styles.civicTextContent}>
                <Text style={styles.civicLabel}>Ubicación del incidente</Text>
                <Text style={styles.civicValue} numberOfLines={2}>
                  {report.address ? normalizeAddress(report.address) : 'Dirección no especificada'}
                </Text>
              </View>
            </View>

            {mapCoords ? (
              <View style={styles.mapWrapper}>
                <MapView
                  style={styles.miniMap}
                  initialRegion={{ latitude: mapCoords.latitude, longitude: mapCoords.longitude, latitudeDelta: 0.002, longitudeDelta: 0.002 }}
                  scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}
                >
                  <Marker coordinate={mapCoords}>
                    <Ionicons name="location" size={32} color="#E63946" />
                  </Marker>
                </MapView>
                <TouchableOpacity style={styles.floatingMapButton} onPress={handleOpenMaps} activeOpacity={0.85}>
                  <Ionicons name="navigate-outline" size={15} color="#fff" />
                  <Text style={styles.floatingMapText}>Abrir en Maps</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.mapEmptyBox}>
                <Ionicons name="location-outline" size={22} color="#94A3B8" />
                <Text style={styles.mapEmptyText}>Ubicación geográfica no disponible en el mapa</Text>
              </View>
            )}
          </View>

          <View style={styles.civicCard}>
            <View style={styles.descriptionHeader}>
              <Text style={styles.civicLabel}>Descripción del suceso</Text>
              {isPending && !isEditing && (
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButtonGhost}>
                  <Ionicons name="pencil" size={14} color="#1D70B8" />
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>
              )}
            </View>

            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput 
                  style={styles.editInput} 
                  value={editedDescription} 
                  onChangeText={setEditedDescription} 
                  multiline 
                  autoFocus 
                  placeholder="Añade más detalles a tu reporte..."
                  placeholderTextColor="#94A3B8"
                />
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelEditBtn} onPress={() => { setIsEditing(false); setEditedDescription(currentDescription); }}>
                    <Text style={styles.cancelEditText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveEditBtn} onPress={handleUpdateDescription} disabled={isProcessing}>
                    {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveEditText}>Guardar cambios</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.descriptionBody}>{currentDescription || 'No se proporcionaron detalles adicionales.'}</Text>
            )}
          </View>

          {/* FASE 3: RESOLUCIÓN OFICIAL PREMIUM */}
          {report.resolution && (
            <View style={[
              styles.resolutionCard, 
              report.status === 'DISMISSED' ? styles.resolutionCardDismissed : styles.resolutionCardResolved
            ]}>
              <View style={styles.resolutionHeaderRow}>
                <View style={[
                  styles.resolutionIconBox, 
                  report.status === 'DISMISSED' ? { backgroundColor: '#FEE2E2' } : { backgroundColor: '#D1FAE5' }
                ]}>
                  <Ionicons 
                    name={report.status === 'DISMISSED' ? "close" : "checkmark"} 
                    size={20} 
                    color={report.status === 'DISMISSED' ? "#DC2626" : "#059669"} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.resolutionTitle, 
                    report.status === 'DISMISSED' ? { color: '#DC2626' } : { color: '#059669' }
                  ]}>
                    {report.status === 'DISMISSED' ? 'Reporte Descartado' : 'Resolución Oficial'}
                  </Text>
                  <Text style={styles.resolutionDateText}>{formatDate(report.resolution.resolvedAt)}</Text>
                </View>
              </View>
              
              <View style={styles.resolutionBodyBox}>
                <Text style={styles.resolutionBodyText}>{report.resolution.description}</Text>
              </View>
              
              {resolutionImages.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.resolutionEvidenceTitle}>Evidencia fotográfica municipal:</Text>
                  <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                    {resolutionImages.map((img: string, idx: number) => (
                      <TouchableOpacity 
                        key={idx} 
                        activeOpacity={0.9} 
                        onPress={() => openGallery(resolutionImages, idx)} 
                        style={{ width: screenWidth - 64, height: 210, marginRight: 8 }}
                      >
                        <Image source={{ uri: getAssetUrl(img) }} style={styles.resolutionImage} resizeMode="cover" />
                        <View style={styles.zoomHintBadge}>
                          <Ionicons name="expand-outline" size={13} color="#fff" />
                          <Text style={styles.zoomHintText}>Tocar para ampliar</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {resolutionImages.length > 1 && (
                    <Text style={styles.resolutionSwipeHint}>
                      Desliza para ver más evidencia ({resolutionImages.length} fotos)
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* FASE 3: TIMELINE DE TRAZABILIDAD REFINADO */}
          {timelineEvents.length > 0 && (
            <View style={styles.timelineWrapper}>
              <Text style={styles.timelineHeaderTitle}>Historial del Reporte</Text>
              <View style={styles.timelineCard}>
                {timelineEvents.map((timelineEvent, index) => (
                  <View key={`${timelineEvent.type === 'status' ? timelineEvent.event.id : 'archived'}-${index}`} style={styles.timelineItem}>
                    <View style={styles.timelineVisuals}>
                      {timelineEvent.type === 'status' ? (
                        <View style={[styles.timelineDot, { backgroundColor: getStatusColor(timelineEvent.event.newStatus) }]}>
                          <Ionicons name={getTimelineIcon(timelineEvent.event.newStatus)} size={12} color="#fff" />
                        </View>
                      ) : (
                        <View style={[styles.timelineDot, { backgroundColor: '#64748B' }]}>
                          <Ionicons name="archive" size={12} color="#fff" />
                        </View>
                      )}
                      {index !== timelineEvents.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    
                    <View style={styles.timelineContentBox}>
                      {timelineEvent.type === 'status' ? (
                        <>
                          <View style={styles.timelineTitleRow}>
                            <Text style={[styles.timelineStatusText, { color: getStatusColor(timelineEvent.event.newStatus) }]}>
                              {getTimelineTitle(timelineEvent.event)}
                            </Text>
                            <Text style={styles.timelineDateTextShort}>
                              {formatShortDate(timelineEvent.event.changedAt)}
                            </Text>
                          </View>
                          
                          {timelineEvent.event.comment ? (
                            <View style={styles.timelineCommentBubble}>
                              <Ionicons name="chatbubble-outline" size={13} color="#64748B" style={{ marginRight: 6, marginTop: 2 }} />
                              <Text style={styles.timelineCommentText}>{timelineEvent.event.comment}</Text>
                            </View>
                          ) : null}
                        </>
                      ) : (
                        <>
                           <View style={styles.timelineTitleRow}>
                            <Text style={[styles.timelineStatusText, { color: '#64748B' }]}>Reporte Archivado</Text>
                            <Text style={styles.timelineDateTextShort}>
                              {formatShortDate(timelineEvent.date)}
                            </Text>
                          </View>
                          <View style={styles.timelineCommentBubble}>
                            <Ionicons name="information-circle-outline" size={14} color="#64748B" style={{ marginRight: 6, marginTop: 2 }} />
                            <Text style={styles.timelineCommentText}>El reporte fue retirado de tu lista principal de seguimiento.</Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* FASE 3: BOTONES DE ACCIÓN REDISEÑADOS */}
          {isPending && !isEditing && (
            <TouchableOpacity style={styles.actionButtonDanger} onPress={handleDelete} disabled={isProcessing}>
              {isProcessing ? <ActivityIndicator size="small" color="#DC2626" /> : (
                <><Ionicons name="trash-outline" size={20} color="#DC2626" /><Text style={styles.actionButtonDangerText}>Cancelar y Eliminar Reporte</Text></>
              )}
            </TouchableOpacity>
          )}

          {isClosed && (
            <TouchableOpacity style={styles.actionButtonSecondary} onPress={handleArchive} disabled={isProcessing}>
              {isProcessing ? <ActivityIndicator size="small" color="#475569" /> : (
                <><Ionicons name="archive-outline" size={20} color="#475569" /><Text style={styles.actionButtonSecondaryText}>Archivar Reporte</Text></>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAwareScrollView>

      <Modal visible={isModalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackground}>
          <TouchableOpacity 
            style={[styles.closeModalButton, { top: Math.max(insets.top + 12, 44) }]} 
            onPress={() => setModalVisible(false)}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            accessibilityRole="button"
            accessibilityLabel="Cerrar visor de fotos"
          >
            <View style={styles.closeModalCircle}>
              <Ionicons name="close" size={22} color="#fff" />
            </View>
          </TouchableOpacity>
          
          {modalImages.length > 0 && (
            <ImageViewer 
              imageUrls={modalImages}
              index={currentImageIndex}
              onChange={(index) => setCurrentImageIndex(index || 0)}
              enableSwipeDown={true}
              onSwipeDown={() => setModalVisible(false)}
              backgroundColor="rgba(0,0,0,0.95)"
              style={{ width: '100%', height: '100%' }}
              renderIndicator={(currentIndex, allSize) => 
                allSize && allSize > 1 ? (
                  <View style={[styles.modalPagination, { top: Math.max(insets.top + 16, 48) }]}>
                    <View style={styles.modalPaginationPill}>
                      <Text style={styles.modalPaginationText}>{currentIndex} / {allSize}</Text>
                    </View>
                  </View>
                ) : <View />
              }
            />
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFBFC' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingTop: 12, 
    paddingBottom: 12, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 10,
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1A1D20', letterSpacing: -0.3 },
  spacer: { width: 40 },
  scrollContent: { flexGrow: 1 },
  
  carouselContainer: { position: 'relative', backgroundColor: '#000' },
  fullImage: { width: '100%', height: 320, backgroundColor: '#111' },
  noImageContainer: { width: '100%', height: 200, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  noImageText: { color: '#64748B', marginTop: 10, fontWeight: '600', fontSize: 13 },
  
  paginationWrapper: { position: 'absolute', bottom: 25, width: '100%', alignItems: 'center', justifyContent: 'center' },
  paginationPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.65)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.4)', marginHorizontal: 4 },
  activeDot: { backgroundColor: '#fff', width: 9, height: 9, borderRadius: 4.5 },
  
  changePhotoButton: { 
    position: 'absolute', 
    bottom: 22, 
    right: 14, 
    backgroundColor: 'rgba(15, 23, 42, 0.85)', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  changePhotoText: { color: '#fff', marginLeft: 6, fontWeight: '700', fontSize: 12 },
  
  content: { 
    paddingHorizontal: 16, 
    paddingTop: 16, 
    marginTop: -20, 
    backgroundColor: '#FAFBFC', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24 
  },
  
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  categoryBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 14,
    maxWidth: '55%',
  },
  categoryText: { fontWeight: '800', marginLeft: 6, fontSize: 12, letterSpacing: -0.2 },
  statusBadge: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11, 
    paddingVertical: 6, 
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  statusText: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' },
  
  civicCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#ECEFF1', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  civicRow: { flexDirection: 'row', alignItems: 'flex-start' },
  civicIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8F9FA', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  civicTextContent: { flex: 1, justifyContent: 'center' },
  civicLabel: { fontSize: 12, color: '#6C757D', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 },
  civicValue: { fontSize: 15, color: '#212529', fontWeight: '500', lineHeight: 20 },
  civicDivider: { height: 1, backgroundColor: '#F0F2F5', marginVertical: 14, marginLeft: 48 },
  
  mapWrapper: { height: 160, borderRadius: 12, overflow: 'hidden', marginTop: 16, position: 'relative', borderWidth: 1, borderColor: '#E9ECEF' },
  miniMap: { flex: 1 },
  floatingMapButton: { 
    position: 'absolute', 
    bottom: 12, 
    right: 12, 
    backgroundColor: '#1E293B', 
    paddingHorizontal: 13, 
    paddingVertical: 7, 
    borderRadius: 18, 
    flexDirection: 'row', 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 3, 
    elevation: 3 
  },
  floatingMapText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 6 },
  mapEmptyBox: { 
    height: 72, 
    backgroundColor: '#F8FAFC', 
    borderRadius: 12, 
    marginTop: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    flexDirection: 'row', 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
  },
  mapEmptyText: { color: '#64748B', fontSize: 13, fontWeight: '500', marginLeft: 8 },
  
  descriptionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  descriptionBody: { fontSize: 15, color: '#495057', lineHeight: 24 },
  editButtonGhost: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F7FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  editButtonText: { color: '#1D70B8', fontWeight: '700', fontSize: 12, marginLeft: 4 },
  editContainer: { marginTop: 4 },
  editInput: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#1D70B8', borderRadius: 12, padding: 14, minHeight: 100, textAlignVertical: 'top', color: '#1A1D20', fontSize: 15, lineHeight: 22, shadowColor: '#1D70B8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  cancelEditBtn: { paddingVertical: 10, paddingHorizontal: 16, marginRight: 8, borderRadius: 10 },
  cancelEditText: { color: '#6C757D', fontWeight: '700', fontSize: 14 },
  saveEditBtn: { backgroundColor: '#1D70B8', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, minWidth: 140, alignItems: 'center' },
  saveEditText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  
  // FASE 3: Resolución Oficial
  resolutionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  resolutionCardResolved: { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' },
  resolutionCardDismissed: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  resolutionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  resolutionIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  resolutionTitle: { fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  resolutionDateText: { fontSize: 13, color: '#64748B', marginTop: 2 },
  resolutionBodyBox: { backgroundColor: '#fff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  resolutionBodyText: { fontSize: 15, color: '#334155', lineHeight: 22 },
  resolutionEvidenceTitle: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8 },
  resolutionImage: { width: '100%', height: 210, borderRadius: 12, backgroundColor: '#E2E8F0' },
  zoomHintBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(15, 23, 42, 0.75)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  zoomHintText: { color: '#fff', fontSize: 11, fontWeight: '600', marginLeft: 4 },
  resolutionSwipeHint: { textAlign: 'center', fontSize: 12, color: '#64748B', marginTop: 8, fontWeight: '600' },
  
  // FASE 3: Timeline / Historial
  timelineWrapper: { marginBottom: 24 },
  timelineHeaderTitle: { fontSize: 13, color: '#64748B', textTransform: 'uppercase', fontWeight: '800', marginBottom: 12, letterSpacing: 0.5, paddingLeft: 4 },
  timelineCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#ECEFF1', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineVisuals: { alignItems: 'center', width: 24, marginRight: 16 },
  timelineDot: { width: 22, height: 22, borderRadius: 11, zIndex: 2, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, backgroundColor: '#E2E8F0', flex: 1, marginVertical: 4, minHeight: 30 },
  timelineContentBox: { flex: 1, paddingBottom: 24, marginTop: -2 },
  timelineTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineStatusText: { fontSize: 15, fontWeight: '800' },
  timelineDateTextShort: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  timelineCommentBubble: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  timelineCommentText: { fontSize: 14, color: '#334155', lineHeight: 20 },
  
  // FASE 3: Footer Buttons
  actionButtonDanger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: '#FECACA', borderStyle: 'dashed', marginBottom: 20 },
  actionButtonDangerText: { color: '#DC2626', fontWeight: '700', fontSize: 15, marginLeft: 8 },
  actionButtonSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  actionButtonSecondaryText: { color: '#475569', fontWeight: '700', fontSize: 15, marginLeft: 8 },
  
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  closeModalButton: { position: 'absolute', right: 20, zIndex: 10 },
  closeModalCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  modalPagination: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 5 },
  modalPaginationPill: { backgroundColor: 'rgba(15, 23, 42, 0.7)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14 },
  modalPaginationText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});