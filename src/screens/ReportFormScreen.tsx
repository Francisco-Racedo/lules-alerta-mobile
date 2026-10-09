import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';

export default function ReportFormScreen({ route }: any) {
  const { category, location } = route.params || {};
  
  const [address, setAddress] = useState<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState<boolean>(true);

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
          console.error("Error en geocodificación:", error);
          setAddress('Error al obtener la dirección');
        } finally {
          setLoadingAddress(false);
        }
      }
    })();
  }, [location]);

  return (
    <View style={styles.container}>
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

      <Text style={styles.subtitle}>Aquí diseñaremos el formulario y la cámara...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa' },
  title: { fontSize: 24, fontWeight: '900', color: '#E63946', marginBottom: 20 },
  gpsBox: { 
    backgroundColor: '#fff', 
    padding: 15, 
    borderRadius: 10, 
    elevation: 3, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 5, 
    marginBottom: 20 
  },
  gpsTitle: { fontWeight: 'bold', color: '#333', marginBottom: 10, fontSize: 16 },
  addressText: { fontSize: 18, color: '#111', fontWeight: '600', marginBottom: 10 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  loadingText: { marginLeft: 10, color: '#666', fontStyle: 'italic' },
  rawCoordsContainer: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  coordText: { color: '#888', fontSize: 12, fontFamily: 'monospace' },
  subtitle: { fontSize: 16, color: '#999', fontStyle: 'italic', marginTop: 20 }
});