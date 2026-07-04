import React, { useEffect, useState } from 'react';
import { Modal, View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { supabase } from '../../utils/supabase';
import * as Location from 'expo-location';
import {oneWeekAgo} from '../../utils/helpers';


type Props = {
  visible: boolean;
  onClose: () => void;
  radiusKm?: number;
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function FreedomWallModal({ visible, onClose, radiusKm = 5 }: Props) {
    const [loading, setLoading] = useState(false);
    const [posts, setPosts] = useState<Array<any>>([]);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

    const getLocation = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            console.warn('Location permission not granted');
            return null;
        }
        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
        });
        return {
            lat: location.coords.latitude,
            lng: location.coords.longitude
        }
    };
    useEffect(() => {
    if (!visible) return;

    const load = async () => {
        setLoading(true);

        const currentLocation = await getLocation();
        if (currentLocation) {
            setLocation(currentLocation);
        }

        // fetch posts (filter client-side by distance)
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .gte('created_at', oneWeekAgo())
          .order('created_at', { ascending: false }).limit(200);
        setLoading(false);

        if (error) {
        console.warn('fetch posts error', error);
        return;
        }

        if (!data) return setPosts([]);

        if (!location) {
        setPosts(data);
        return;
        }

        const filtered = data.filter((p: any) => {
        if (!p.location) return false;
        const parts = String(p.location).split(',');
        if (parts.length < 2) return false;
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
        const d = haversineDistance(location.lat, location.lng, lat, lng);
        return d <= radiusKm;
        });

        setPosts(filtered);
    };

    load();
    }, [visible]);

    return (
    <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
        <View style={styles.card}>
            <View style={styles.header}>
            <Text style={styles.title}>Freedom Wall</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>Close</Text>
            </Pressable>
            </View>

            {loading ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
            ) : (
            <FlatList
                data={posts}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                <View style={styles.post}>
                    <Text style={styles.postContent}>{item.content}</Text>
                    <Text style={styles.postMeta}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</Text>
                </View>
                )}
                ListEmptyComponent={<Text style={{ color: '#9ca3af', marginTop: 12 }}>No posts nearby.</Text>}
            />
            )}
        </View>
        </View>
    </Modal>
    );
    }

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#0b1220',
    borderRadius: 12,
    maxHeight: '80%',
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {},
  closeText: { color: '#60a5fa', fontWeight: '600' },
  post: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#0f1724',
    marginBottom: 8,
  },
  postContent: { color: '#f8fafc' },
  postMeta: { color: '#94a3b8', marginTop: 6, fontSize: 12 },
});
