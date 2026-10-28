import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert as NativeAlert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

export default function DetalleReporteScreen({ route, navigation }: any) {
  const { report } = route.params;
  const insets = useSafeAreaInsets();
  const BASE_URL = 'http://192.168.100.131:3000';

  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState(report.description || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentDescription, setCurrentDescription] = useState(report.description || '');
  const [currentImage, setCurrentImage] = useState(report.imageUrl);

  const isPending = report.status === 'PENDING';
  const isClosed = report.status === 'RESOLVED' || report.status === 'DISMISSED';

  // Ordenamos el historial del más reciente al más antiguo
  const timelineEvents = Array.isArray(report.history) 
    ? [...report.history].sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
    : [];

  const handleUpdatePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Toast.show({ type: 'error', text1: 'Permiso denegado', text2: 'Se requiere acceso a la galería.' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0].uri) {
        setIsProcessing(true);
        const imageUri = result.assets[0].uri;
        const filename = imageUri.split('/').pop() || 'evidencia.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        const uploadResult = await FileSystem.uploadAsync(`${BASE_URL}/alerts/${report.id}/image`, imageUri, {
          httpMethod: 'PATCH',
          uploadType: 1 as any,
          fieldName: 'file',
          mimeType: type,
        });

        if (uploadResult.status === 200) {
          const updatedAlert = JSON.parse(uploadResult.body);
          setCurrentImage(updatedAlert.imageUrl);
          Toast.show({ type: 'success', text1: 'Foto actualizada', text2: 'La evidencia se cambió correctamente.', position: 'top' });
        } else {
          throw new Error('Fallo en el servidor');
        }
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo actualizar la imagen.', position: 'top' });
    } finally {
      setIsProcessing(false);
    }
  };

  let mapCoords = null;
  if (report.location && report.location.coordinates && Array.isArray(report.location.coordinates)) {
    mapCoords = {
      latitude: Number(report.location.coordinates[1]),
      longitude: Number(report.location.coordinates[0]),
    };
  } else if (report.latitude && report.longitude) {
    mapCoords = {
      latitude: Number(report.latitude),
      longitude: Number(report.longitude),
    };
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return '#F4A261'; // Naranja
      case 'IN_PROGRESS': return '#2A9D8F'; // Verde agua
      case 'RESOLVED': return '#264653'; // Azul oscuro
      case 'DISMISSED': return '#E63946'; // Rojo
      default: return '#666';
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
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    };
    return new Date(dateString).toLocaleDateString('es-ES', options);
  };

  const handleUpdateDescription = async () => {
    if (!editedDescription.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'La descripción no puede estar vacía.', position: 'top' });
      return;
    }
    
    setIsProcessing(true);
    try {
      const response = await fetch(`${BASE_URL}/alerts/${report.id}/description`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editedDescription.trim() })
      });

      if (!response.ok) throw new Error('Error al actualizar');
      
      setCurrentDescription(editedDescription.trim());
      setIsEditing(false);
      Toast.show({ type: 'success', text1: 'Actualizado', text2: 'La descripción fue guardada con éxito.', position: 'top' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error de Red', text2: 'No se pudo actualizar el reporte.', position: 'top' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = () => {
    NativeAlert.alert(
      "Cancelar Reporte",
      "¿Estás seguro de que deseas eliminar este reporte de emergencia? Esta acción no se puede deshacer.",
      [
        { text: "No, mantener", style: "cancel" },
        { 
          text: "Sí, cancelar alerta", 
          style: "destructive",
          onPress: async () => {
            setIsProcessing(true);
            try {
              const response = await fetch(`${BASE_URL}/alerts/${report.id}`, { method: 'DELETE' });
              if (!response.ok) throw new Error('Error al eliminar');
              
              Toast.show({ type: 'success', text1: 'Cancelado', text2: 'El reporte fue eliminado correctamente.', position: 'top' });
              navigation.goBack();
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Fallo al Eliminar', text2: 'Ocurrió un error de conexión.', position: 'top' });
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };

  const handleArchive = () => {
    NativeAlert.alert(
      "Archivar Reporte",
      "¿Deseas ocultar este reporte de tu lista principal? Podrás mantener la limpieza de tus gestiones.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, archivar", 
          style: "default",
          onPress: async () => {
            setIsProcessing(true);
            try {
              const response = await fetch(`${BASE_URL}/alerts/${report.id}/archive`, { method: 'PATCH' });
              if (!response.ok) throw new Error('Error al archivar');
              
              Toast.show({ type: 'success', text1: 'Archivado', text2: 'El reporte fue ocultado correctamente.', position: 'top' });
              navigation.goBack();
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo archivar el reporte.', position: 'top' });
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} disabled={isProcessing}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle del Reporte</Text>
        <View style={styles.spacer} />
      </View>

      <KeyboardAwareScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        enableOnAndroid={true}
        extraScrollHeight={120} 
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ position: 'relative' }}>
          {currentImage ? (
            <Image source={{ uri: `${BASE_URL}${currentImage}?t=${new Date().getTime()}` }} style={styles.fullImage} resizeMode="cover" />
          ) : (
            <View style={styles.noImageContainer}>
              <Ionicons name="image-outline" size={50} color="#ccc" />
              <Text style={styles.noImageText}>Sin evidencia fotográfica</Text>
            </View>
          )}
          
          {isPending && (
            <TouchableOpacity 
              style={{ position: 'absolute', bottom: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }} 
              onPress={handleUpdatePhoto}
              disabled={isProcessing}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', marginLeft: 5, fontWeight: 'bold', fontSize: 12 }}>Cambiar Foto</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.categoryBadge}>
              <Ionicons name="warning" size={16} color="#E63946" />
              <Text style={styles.categoryText}>{report.category}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
              <Text style={styles.statusText}>{getStatusText(report.status)}</Text>
            </View>
          </View>

          <View style={styles.infoBlock}>
            <Ionicons name="calendar-outline" size={20} color="#666" style={styles.icon} />
            <View>
              <Text style={styles.infoLabel}>Fecha y Hora (Inmutable)</Text>
              <Text style={styles.infoValue}>{formatDate(report.createdAt)}</Text>
            </View>
          </View>

          <View style={styles.infoBlock}>
            <Ionicons name="location-outline" size={20} color="#666" style={styles.icon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Ubicación de origen (Inmutable)</Text>
              <Text style={styles.infoValue}>{report.address || 'Dirección no especificada'}</Text>
            </View>
          </View>

          {mapCoords ? (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.miniMap}
                initialRegion={{
                  latitude: mapCoords.latitude,
                  longitude: mapCoords.longitude,
                  latitudeDelta: 0.002,
                  longitudeDelta: 0.002,
                }}
                scrollEnabled={true}
                zoomEnabled={true}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker coordinate={mapCoords}>
                  <Ionicons name="location" size={36} color="#E63946" />
                </Marker>
              </MapView>
            </View>
          ) : (
            <View style={[styles.mapContainer, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffe6e6', padding: 15 }]}>
              <Ionicons name="alert-circle-outline" size={30} color="#E63946" style={{ marginBottom: 5 }} />
              <Text style={{ color: '#E63946', textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>
                Error de coordenadas backend:
              </Text>
              <Text style={{ color: '#E63946', textAlign: 'center', fontSize: 10, marginTop: 5 }}>
                {JSON.stringify(report.location) || 'El campo location es null o indefinido.'}
              </Text>
            </View>
          )}

          <View style={styles.descriptionBlock}>
            <View style={styles.descriptionHeader}>
              <Text style={styles.infoLabel}>Descripción del suceso</Text>
              {isPending && !isEditing && (
                <TouchableOpacity onPress={() => setIsEditing(true)}>
                  <Ionicons name="pencil" size={18} color="#2A9D8F" />
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
                />
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setIsEditing(false)}>
                    <Text style={styles.cancelEditText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveEditBtn} onPress={handleUpdateDescription} disabled={isProcessing}>
                    {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveEditText}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.descriptionText}>
                {currentDescription || 'No se proporcionaron detalles adicionales para este reporte.'}
              </Text>
            )}
          </View>

          {report.resolution && (
            <View style={[styles.resolutionBlock, report.status === 'DISMISSED' && { backgroundColor: '#ffe6e6', borderColor: '#ffcccc' }]}>
              <View style={styles.resolutionHeader}>
                <Ionicons 
                  name={report.status === 'DISMISSED' ? "close-circle" : "checkmark-circle"} 
                  size={24} 
                  color={report.status === 'DISMISSED' ? "#E63946" : "#2A9D8F"} 
                />
                <Text style={[styles.resolutionTitle, report.status === 'DISMISSED' && { color: '#E63946' }]}>
                  {report.status === 'DISMISSED' ? 'Reporte Descartado' : 'Trabajo Finalizado'}
                </Text>
              </View>
              <Text style={styles.resolutionDate}>{formatDate(report.resolution.resolvedAt)}</Text>
              <Text style={styles.resolutionText}>{report.resolution.description}</Text>
              {report.resolution.imageUrl && (
                <Image source={{ uri: `${BASE_URL}${report.resolution.imageUrl}` }} style={styles.resolutionImage} resizeMode="cover" />
              )}
            </View>
          )}

          {timelineEvents.length > 0 && (
            <View style={styles.timelineWrapper}>
              <Text style={styles.timelineHeaderTitle}>Trazabilidad de Autoridades</Text>
              <View style={styles.timelineContainer}>
                {timelineEvents.map((event, index) => (
                  <View key={`${event.id}-${index}`} style={styles.timelineItem}>
                    <View style={styles.timelineVisuals}>
                      <View style={[styles.timelineDot, { backgroundColor: getStatusColor(event.newStatus) }]} />
                      {index !== timelineEvents.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineContentBox}>
                      <Text style={[styles.timelineStatusText, { color: getStatusColor(event.newStatus) }]}>
                        {getStatusText(event.newStatus)}
                      </Text>
                      <Text style={styles.timelineDateText}>{formatDate(event.changedAt)}</Text>
                      {event.comment ? (
                        <Text style={styles.timelineCommentText}>{event.comment}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Botón de Cancelar / Eliminar (Solo PENDING) */}
          {isPending && !isEditing && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={isProcessing}>
              {isProcessing ? (
                <ActivityIndicator size="small" color="#E63946" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={20} color="#E63946" />
                  <Text style={styles.deleteButtonText}>Cancelar Alerta y Eliminar</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Botón de Archivar (Solo RESOLVED o DISMISSED) */}
          {isClosed && (
            <TouchableOpacity style={styles.archiveButton} onPress={handleArchive} disabled={isProcessing}>
              {isProcessing ? (
                <ActivityIndicator size="small" color="#264653" />
              ) : (
                <>
                  <Ionicons name="archive-outline" size={20} color="#264653" />
                  <Text style={styles.archiveButtonText}>Archivar y Ocultar de la Lista</Text>
                </>
              )}
            </TouchableOpacity>
          )}

        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 15, paddingBottom: 15, backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  spacer: { width: 34 },
  fullImage: { width: '100%', height: 300, backgroundColor: '#eee' },
  noImageContainer: { width: '100%', height: 200, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  noImageText: { color: '#888', marginTop: 10 },
  content: { padding: 20, marginTop: -20, backgroundColor: '#f8f9fa', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffe6e6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  categoryText: { color: '#E63946', fontWeight: 'bold', marginLeft: 6, fontSize: 14 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  statusText: { color: '#fff', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' },
  infoBlock: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: '#fff', padding: 15, borderRadius: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  icon: { marginRight: 15 },
  infoLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#333', fontWeight: '500', textTransform: 'capitalize' },
  mapContainer: { height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 20, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, borderWidth: 1, borderColor: '#eee' },
  miniMap: { flex: 1 },
  descriptionBlock: { backgroundColor: '#fff', padding: 15, borderRadius: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, marginBottom: 30 },
  descriptionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  descriptionText: { fontSize: 15, color: '#444', lineHeight: 22, marginTop: 8 },
  editContainer: { marginTop: 10 },
  editInput: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', color: '#333' },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  cancelEditBtn: { paddingVertical: 8, paddingHorizontal: 15, marginRight: 10 },
  cancelEditText: { color: '#666', fontWeight: '600' },
  saveEditBtn: { backgroundColor: '#2A9D8F', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
  saveEditText: { color: '#fff', fontWeight: 'bold' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffe6e6', paddingVertical: 15, borderRadius: 12, borderWidth: 1, borderColor: '#ffcccc', borderStyle: 'dashed' },
  deleteButtonText: { color: '#E63946', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  archiveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e9f5f4', paddingVertical: 15, borderRadius: 12, borderWidth: 1, borderColor: '#b2dfdb', marginTop: 15 },
  archiveButtonText: { color: '#264653', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },

  // Estilos de la Resolución Oficial
  resolutionBlock: { backgroundColor: '#e9f5f4', padding: 15, borderRadius: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, marginBottom: 30, borderWidth: 1, borderColor: '#b2dfdb' },
  resolutionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  resolutionTitle: { fontSize: 16, fontWeight: 'bold', color: '#2A9D8F', marginLeft: 8, textTransform: 'uppercase' },
  resolutionDate: { fontSize: 12, color: '#666', marginBottom: 10, textTransform: 'capitalize' },
  resolutionText: { fontSize: 15, color: '#333', lineHeight: 22, marginBottom: 15 },
  resolutionImage: { width: '100%', height: 200, borderRadius: 8, backgroundColor: '#ccc' },
  
  // Estilos de la Línea de Tiempo
  timelineWrapper: { marginBottom: 30 },
  timelineHeaderTitle: { fontSize: 14, color: '#888', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 15 },
  timelineContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineVisuals: { alignItems: 'center', width: 24, marginRight: 15 },
  timelineDot: { width: 14, height: 14, borderRadius: 7, zIndex: 2 },
  timelineLine: { width: 2, backgroundColor: '#eee', flex: 1, marginTop: 4, marginBottom: 4, minHeight: 40 },
  timelineContentBox: { flex: 1, paddingBottom: 25, marginTop: -3 },
  timelineStatusText: { fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  timelineDateText: { fontSize: 12, color: '#999', marginBottom: 6, textTransform: 'capitalize' },
  timelineCommentText: { fontSize: 14, color: '#555', fontStyle: 'italic', backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8, overflow: 'hidden' },
});