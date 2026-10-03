import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Motor Web oficial de Google Maps con tu API Key inyectada
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

          // Punto Azul del usuario
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
      <!-- Aquí está tu clave oficial de Google vinculada al mapa -->
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
      
      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8}
        onPress={() => console.log("Abrir menú de reporte")}
      >
        <Ionicons name="megaphone" size={24} color="white" />
        <Text style={styles.fabText}>Reportar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  fab: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: '#E63946',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 8 }
});