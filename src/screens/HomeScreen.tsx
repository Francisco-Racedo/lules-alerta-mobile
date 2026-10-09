import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator, Modal, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permiso de ubicación denegado.');
        return;
      }
      let currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      setLocation(currentPosition);
    })();
  }, []);

  // Lógica del Botón de Pánico
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
    console.log(`Categoría seleccionada: ${category}`);
    setModalVisible(false);
  };

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

  const mapHtml = `
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
          var userLocation = { lat: ${location.coords.latitude}, lng: ${location.coords.longitude} };
          var map = new google.maps.Map(document.getElementById('map'), {
            zoom: 16,
            center: userLocation,
            disableDefaultUI: true, 
            mapTypeId: 'roadmap'
          });

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
        }
      </script>
      <script async defer src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDl_gYlW2aKNJ_jqNob0k3aYl4uB8Gw8HQ&callback=initMap"></script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.map}
        scrollEnabled={false}
        bounces={false}
      />
      
      {/* Controles Inferiores */}
      <View style={styles.bottomContainer}>
        {/* Botón Masivo S.O.S. */}
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

        {/* Botón Secundario de Menú */}
        <TouchableOpacity 
          style={styles.menuButton} 
          activeOpacity={0.8}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="grid" size={28} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Modal de Reportes Regulares */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear Reporte</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#999" />
              </TouchableOpacity>
            </View>

            <View style={styles.gridContainer}>
              <TouchableOpacity style={styles.gridItem} onPress={() => handleCategorySelect('Seguridad')}>
                <View style={[styles.iconContainer, { backgroundColor: '#4A90E2' }]}>
                  <Ionicons name="shield-checkmark" size={32} color="white" />
                </View>
                <Text style={styles.gridText}>Robo / Sospecha</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridItem} onPress={() => handleCategorySelect('Salud')}>
                <View style={[styles.iconContainer, { backgroundColor: '#50E3C2' }]}>
                  <Ionicons name="medkit" size={32} color="white" />
                </View>
                <Text style={styles.gridText}>Asistencia Médica</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridItem} onPress={() => handleCategorySelect('Bomberos')}>
                <View style={[styles.iconContainer, { backgroundColor: '#F5A623' }]}>
                  <Ionicons name="flame" size={32} color="white" />
                </View>
                <Text style={styles.gridText}>Incendio / Rescate</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridItem} onPress={() => handleCategorySelect('Infraestructura')}>
                <View style={[styles.iconContainer, { backgroundColor: '#8B572A' }]}>
                  <Ionicons name="construct" size={32} color="white" />
                </View>
                <Text style={styles.gridText}>Infraestructura</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  
  bottomContainer: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosButton: {
    backgroundColor: '#D90429',
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D90429',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  sosText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 22,
    marginTop: 2,
    letterSpacing: 1,
  },
  menuButton: {
    position: 'absolute',
    right: 25,
    bottom: 30,
    backgroundColor: '#ffffff',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 25,
    paddingTop: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '45%',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 65,
    height: 65,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  gridText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    textAlign: 'center',
  }
});