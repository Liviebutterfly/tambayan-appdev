import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../utils/supabase';
import * as Location from 'expo-location';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPosted?: () => void;
};

export default function LeavePostModal({ visible, onClose, onPosted }: Props) {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

    // function for getting location
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
        };
    };

    // loading location when modal is visible
    useEffect(() => {
        if (!visible) return;
        // try to get current position
        const loadLocation = async () => {
            const currentLocation = await getLocation();
            if (currentLocation) {
                setLocation(currentLocation);
            }
        }
        loadLocation();
    }, [visible]);

    const handleSubmit = async () => {
    if (!content.trim()) {
        Alert.alert('Empty post', 'Please write something before posting.');
        return;
    }

    setLoading(true);

    const {
        data: { session },
        error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr || !session) {
        setLoading(false);
        Alert.alert('Not authenticated', 'Please sign in to leave a post.');
        onClose();
        return;
    }

    const payload: any = {
        user_id: session.user.id,
        content: content.trim(),
        created_at: new Date().toISOString(),
    };

    if (location) {
        payload.location = `${location.lat},${location.lng}`;
    }

    const { error } = await supabase.from('posts').insert(payload);
    setLoading(false);

    if (error) {
        Alert.alert('Post failed', error.message);
        return;
    }

    setContent('');
    Alert.alert('Posted', 'Your post was added to the Freedom Wall.');
    onClose();
    if (onPosted) onPosted();
    };

    return (
    <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
        <View style={styles.card}>
            <Text style={styles.title}>Leave a mark</Text>

            <TextInput
            style={styles.input}
            placeholder="What do you want to say?"
            placeholderTextColor="#94a3b8"
            value={content}
            onChangeText={setContent}
            multiline
            />

            <View style={styles.row}>
            <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Post</Text>}
            </Pressable>
            <Pressable style={[styles.button, styles.cancel]} onPress={onClose}>
                <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
            </View>
        </View>
        </View>
    </Modal>
    );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    minHeight: 100,
    backgroundColor: '#172133',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancel: {
    backgroundColor: '#374151',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
