import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppState, Platform, StyleSheet, View, TouchableOpacity, Text, ActivityIndicator, Modal, Alert, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';

const LOCATION_REQUEST_TIMEOUT_MS = 10000;

export default function HomeScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locationErrorType, setLocationErrorType] = useState<
    'permission' | 'services' | 'unknown' | null
  >(null);
  const [modalVisible, setModalVisible] = useState(false);
  const locationRequestInFlight = useRef(false);
  const locationRef = useRef<Location.LocationObject | null>(null);
  const [selectedFocusLocation, setSelectedFocusLocation] = useState(
    route.params?.focusLocation ?? null,
  );

  // Recibimos parámetros externos si el usuario presionó "Ver en Mapa" desde un aviso
  const focusLocation =
    selectedFocusLocation ?? route.params?.focusLocation ?? null;

  // NUEVO: Escuchamos la señal de radio silenciosa para abrir el modal sin recargar
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('reopenCategoryModal', () => {
      setModalVisible(true);
    });

    const focusSubscription = DeviceEventEmitter.addListener(
      'focusNoticeLocation',
      (nextFocusLocation) => {
        setSelectedFocusLocation(nextFocusLocation);
      },
    );

    return () => {
      subscription.remove();
      focusSubscription.remove();
    };
  }, []);

  const loadLocation = useCallback(async () => {
    if (locationRequestInFlight.current) {
      return;
    }

    locationRequestInFlight.current = true;
    setErrorMsg(null);
    setLocationErrorType(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocation(null);
        locationRef.current = null;
        setLocationErrorType('permission');
        setErrorMsg(
          'Necesitamos permiso de ubicación para mostrar el mapa y crear reportes precisos.',
        );
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocation(null);
        locationRef.current = null;
        setLocationErrorType('services');
        setErrorMsg(
          'La ubicación del dispositivo está desactivada. Actívala y vuelve a la aplicación.',
        );
        return;
      }

      const currentPosition = await new Promise<Location.LocationObject>(
        (resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(
              new Error('La solicitud de ubicación agotó el tiempo de espera.'),
            );
          }, LOCATION_REQUEST_TIMEOUT_MS);

          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }).then(resolve, reject).finally(() => {
            clearTimeout(timeoutId);
          });
        },
      );
      locationRef.current = currentPosition;
      setLocation(currentPosition);
    } catch (error) {
      console.error('Error obteniendo la ubicación:', error);
      setLocation(null);
      locationRef.current = null;
      setLocationErrorType('unknown');
      setErrorMsg(
        'No pudimos obtener tu ubicación. Verifica que el GPS esté activo e inténtalo nuevamente.',
      );
    } finally {
      locationRequestInFlight.current = false;
    }
  }, []);

  const handleLocationRecovery = async () => {
    if (locationErrorType === 'services' && Platform.OS === 'android') {
      try {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS,
        );
        await loadLocation();
      } catch (error) {
        console.error('Error abriendo los ajustes de ubicación:', error);
        setErrorMsg(
          'No pudimos abrir los ajustes de ubicación. Activa el GPS manualmente e inténtalo nuevamente.',
        );
      }
      return;
    }

    await loadLocation();
  };

  useEffect(() => {
    void loadLocation();
  }, [loadLocation]);

  useEffect(() => {
    let previousState = AppState.currentState;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const returnedToForeground =
        previousState !== 'active' && nextState === 'active';

      previousState = nextState;

      if (returnedToForeground) {
        void loadLocation();
      }
    });

    return () => subscription.remove();
  }, [loadLocation]);

  useEffect(() => {
    let isMounted = true;

    const checkLocationServices = async () => {
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();

        if (!isMounted) {
          return;
        }

        if (!servicesEnabled) {
          locationRef.current = null;
          setLocation(null);
          setLocationErrorType('services');
          setErrorMsg(
            'La ubicación del dispositivo está desactivada. Actívala para continuar.',
          );
          return;
        }

        if (
          !locationRef.current &&
          (locationErrorType === null || locationErrorType === 'services') &&
          !locationRequestInFlight.current
        ) {
          void loadLocation();
        }
      } catch (error) {
        console.error('Error verificando los servicios de ubicación:', error);
      }
    };

    const intervalId = setInterval(() => {
      void checkLocationServices();
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [loadLocation, locationErrorType]);

  const handlePanicSOS = () => {
    Alert.alert(
      "🚨 ALERTA S.O.S. ACTIVADA",
      "Tu ubicación exacta ha sido enviada al centro de monitoreo. Un móvil policial está en camino.",
      [{ text: "Entendido", style: "destructive" }]
    );
  };

  const handleShortSOSPress = () => {
    Alert.alert(
      "Atención", 
      "Para activar la alerta de pánico S.O.S., mantén presionado el botón rojo por 2 segundos."
    );
  };

  const handleCategorySelect = (category: string) => {
    setModalVisible(false);
    navigation.navigate('ReportForm', { category, location });
  };

  // Generamos el HTML del mapa adaptándose si hay un punto a destacar o solo la posición actual
  const mapHtml = useMemo(() => {
    if (!location) return '';

    // Si recibimos un focusLocation (desde Avisos), centramos ahí y ponemos un pin rojo especial
    const targetLat = focusLocation ? focusLocation.latitude : location.coords.latitude;
    const targetLng = focusLocation ? focusLocation.longitude : location.coords.longitude;
    const hasFocusPin = !!focusLocation;
    const pinTitle = focusLocation ? focusLocation.title : 'Mi ubicación actual';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          body { padding: 0; margin: 0; }
          #map { width: 100vw; height: 100vh; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          function initMap() {
            var centerLocation = { lat: ${targetLat}, lng: ${targetLng} };
            var map = new google.maps.Map(document.getElementById('map'), {
              zoom: 17,
              center: centerLocation,
              disableDefaultUI: true, 
              mapTypeId: 'roadmap'
            });

            // Marcador de la posición actual del usuario (Azul)
            var userLocation = { lat: ${location.coords.latitude}, lng: ${location.coords.longitude} };
            new google.maps.Marker({
              position: userLocation,
              map: map,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: 2
              }
            });

            // Si viene un punto enfocado desde los avisos, dibujamos un marcador rojo destacado
            if (${hasFocusPin}) {
              var focusMarker = new google.maps.Marker({
                position: centerLocation,
                map: map,
                title: "${pinTitle}",
                animation: google.maps.Animation.DROP
              });

              var infoWindow = new google.maps.InfoWindow({
                content: "<div style='font-family: sans-serif; padding: 5px;'><b style='color: #E63946;'>${focusLocation?.title}</b><p style='margin: 5px 0 0 0; font-size: 12px;'>${focusLocation?.address || 'Ubicación del incidente'}</p></div>"
              });

              focusMarker.addListener('click', function() {
                infoWindow.open(map, focusMarker);
              });
              
              // Abrir la ventanita de información automáticamente
              infoWindow.open(map, focusMarker);
            }
          }
        </script>
        <script async defer src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDl_gYlW2aKNJ_jqNob0k3aYl4uB8Gw8HQ&callback=initMap"></script>
      </body>
      </html>
    `;
  }, [location, focusLocation]);

  if (!location && errorMsg) {
    return (
      <View style={[styles.container, styles.locationErrorContainer]}>
        <Ionicons name="location-outline" size={64} color="#E63946" />
        <Text style={styles.locationErrorTitle}>Ubicación no disponible</Text>
        <Text style={styles.locationErrorText}>{errorMsg}</Text>
        <TouchableOpacity
          style={styles.retryLocationButton}
          onPress={() => void handleLocationRecovery()}
        >
          <Text style={styles.retryLocationButtonText}>
            {locationErrorType === 'services'
              ? 'Activar ubicación'
              : 'Reintentar'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#E63946" />
        <Text style={{ marginTop: 15, fontSize: 16, color: '#555' }}>
          Conectando con satélites GPS...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.map}
        scrollEnabled={false}
        bounces={false}
      />
      
      <View style={styles.bottomContainer}>
        <TouchableOpacity 
          style={styles.sosButton} 
          activeOpacity={0.8}
          onPress={handleShortSOSPress}
          onLongPress={handlePanicSOS}
          delayLongPress={1500}
        >
          <Ionicons name="warning" size={36} color="white" />
          <Text style={styles.sosText}>S.O.S.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuButton} 
          activeOpacity={0.8}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="grid" size={28} color="#333" />
        </TouchableOpacity>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + 20, 36) }]}>
            {/* DRAGGER INDICATOR */}
            <View style={styles.modalDragger} />

            {/* HEADER MODAL */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTextWrapper}>
                <Text style={styles.modalTitle}>Crear Reporte</Text>
                <Text style={styles.modalSubtitle}>Selecciona el área municipal correspondiente</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                style={styles.closeModalCircle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Cerrar ventana de reporte"
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* 4 CATEGORÍAS EN TARJETAS TÁCTILES */}
            <View style={styles.gridContainer}>
              <TouchableOpacity 
                style={[styles.categoryCard, styles.cardSeguridad]} 
                onPress={() => handleCategorySelect('Seguridad')}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIconCircle, { backgroundColor: '#1D70B8' }]}>
                  <Ionicons name="shield-checkmark" size={24} color="#fff" />
                </View>
                <Text style={[styles.cardTitle, { color: '#1D70B8' }]}>Seguridad</Text>
                <Text style={styles.cardSubtitle}>Robo, vehículo o actitud sospechosa</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.categoryCard, styles.cardSalud]} 
                onPress={() => handleCategorySelect('Salud')}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIconCircle, { backgroundColor: '#2A9D8F' }]}>
                  <Ionicons name="medkit" size={24} color="#fff" />
                </View>
                <Text style={[styles.cardTitle, { color: '#2A9D8F' }]}>Salud</Text>
                <Text style={styles.cardSubtitle}>Ambulancia y urgencia médica</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.categoryCard, styles.cardBomberos]} 
                onPress={() => handleCategorySelect('Bomberos')}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIconCircle, { backgroundColor: '#E76F51' }]}>
                  <Ionicons name="flame" size={24} color="#fff" />
                </View>
                <Text style={[styles.cardTitle, { color: '#E76F51' }]}>Bomberos</Text>
                <Text style={styles.cardSubtitle}>Incendio, rescate o escape de gas</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.categoryCard, styles.cardInfraestructura]} 
                onPress={() => handleCategorySelect('Infraestructura')}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIconCircle, { backgroundColor: '#D97706' }]}>
                  <Ionicons name="construct" size={24} color="#fff" />
                </View>
                <Text style={[styles.cardTitle, { color: '#B45309' }]}>Servicios</Text>
                <Text style={styles.cardSubtitle}>Baches, cloacas o luminarias</Text>
              </TouchableOpacity>
            </View>

            {/* AVISO INFORMATIVO INFERIOR */}
            <View style={styles.modalFooterHint}>
              <Ionicons name="information-circle-outline" size={16} color="#64748B" />
              <Text style={styles.modalFooterText}>
                Ante peligro o riesgo inminente pulsa el botón rojo <Text style={{ fontWeight: '800', color: '#D90429' }}>S.O.S.</Text>
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  locationErrorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  locationErrorTitle: {
    color: '#333',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  locationErrorText: {
    color: '#666',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
    textAlign: 'center',
  },
  retryLocationButton: {
    backgroundColor: '#E63946',
    borderRadius: 10,
    marginTop: 24,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  retryLocationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  map: { flex: 1 }, 
  bottomContainer: { position: 'absolute', bottom: 30, width: '100%', alignItems: 'center', justifyContent: 'center' },
  sosButton: { backgroundColor: '#D90429', width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', shadowColor: '#D90429', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 10, elevation: 10, borderWidth: 4, borderColor: 'rgba(255, 255, 255, 0.4)' },
  sosText: { color: 'white', fontWeight: '900', fontSize: 22, marginTop: 2, letterSpacing: 1 },
  menuButton: { position: 'absolute', right: 25, bottom: 30, backgroundColor: '#ffffff', width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
  
  // MODAL CREAR REPORTE
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28, 
    paddingHorizontal: 20, 
    paddingTop: 12, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: -4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 12, 
    elevation: 12 
  },
  modalDragger: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  modalHeaderTextWrapper: { flex: 1, marginRight: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1A1D20', letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 13, color: '#64748B', marginTop: 3, fontWeight: '500' },
  closeModalCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2x2 GRID DE TARJETAS
  gridContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categoryCard: {
    width: '48%',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    minHeight: 136,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSeguridad: {
    backgroundColor: '#F0F7FD',
    borderColor: '#D0E3F7',
  },
  cardSalud: {
    backgroundColor: '#E6F7F5',
    borderColor: '#C2EBE5',
  },
  cardBomberos: {
    backgroundColor: '#FEF4E8',
    borderColor: '#FCDCC2',
  },
  cardInfraestructura: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    marginBottom: 10,
  },
  cardTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  cardSubtitle: { 
    fontSize: 11, 
    color: '#64748B', 
    lineHeight: 15,
    fontWeight: '500',
  },

  // PIE DEL MODAL
  modalFooterHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalFooterText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 6,
    fontWeight: '500',
  },
});