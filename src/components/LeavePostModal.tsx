import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, Image, Animated } from 'react-native';
import { supabase } from '../../utils/supabase';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPosted?: () => void;
};

type MoodOption = {
  value: 'nostalgic' | 'peaceful' | 'romantic' | 'motivational';
  label: string;
  image: string;
};

const moodBackgroundMap: Record<MoodOption['value'], string> = {
  nostalgic: '#c1dae0',
  peaceful: '#cef0db',
  romantic: '#f7e4ea',
  motivational: '#f2f0d8',
};

const moodOptions: MoodOption[] = [
  { value: 'nostalgic', label: 'Nostalgic', image: require('../../assets/images/happy.png') },
  { value: 'peaceful', label: 'Peaceful', image: require('../../assets/images/calm.png') },
  { value: 'romantic', label: 'Romantic', image: require('../../assets/images/sad.png') },
  { value: 'motivational', label: 'Motivational', image: require('../../assets/images/angry.png') },
];

type MoodOptionButtonProps = {
  option: MoodOption;
  active: boolean;
  onPress: () => void;
};

function MoodOptionButton({ option, active, onPress }: MoodOptionButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.05 : 1,
      useNativeDriver: true,
      friction: 6,
      tension: 70,
    }).start();
  }, [active, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        key={option.value}
        style={[styles.moodOption, active && styles.moodOptionActive]}
        onPress={onPress}
      >
        <Image source={option.image as any} style={styles.moodIcon} />
      </Pressable>
    </Animated.View>
  );
}

export default function LeavePostModal({ visible, onClose, onPosted }: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodOption['value']>('nostalgic');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [remainingMarks, setRemainingMarks] = useState(5);

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted');
      return null;
    }

    const currentLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });

    return {
      lat: currentLocation.coords.latitude,
      lng: currentLocation.coords.longitude,
    };
  };

  useEffect(() => {
    if (!visible) return;

    const loadLocation = async () => {
      const currentLocation = await getLocation();
      if (currentLocation) {
        setLocation(currentLocation);
      }
    };

    const loadWeeklyMarkLimit = async () => {
      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();

      if (sessionErr || !session) {
        setRemainingMarks(5);
        return;
      }

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { count, error } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .gte('created_at', oneWeekAgo);

      if (!error) {
        setRemainingMarks(Math.max(5 - (count ?? 0), 0));
      }
    };

    loadLocation();
    loadWeeklyMarkLimit();
  }, [visible]);

  const getContentType = (asset: ImagePicker.ImagePickerAsset | null) => {
    const mimeType = asset?.mimeType || asset?.type;
    if (mimeType && mimeType.includes('/')) {
      return mimeType;
    }

    const extension = asset?.uri?.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photos to upload an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets?.[0]) {
      setSelectedImage(result.assets[0]);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
  };

  const handleSubmit = async () => {
    if (!content.trim() && !selectedImage) {
      Alert.alert('Empty post', 'Please write something or add an image before posting.');
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

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { count, error: weeklyCountError } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .gte('created_at', oneWeekAgo);

    if (weeklyCountError) {
      setLoading(false);
      Alert.alert('Unable to check post limit', weeklyCountError.message);
      return;
    }

    const weeklyPostCount = count ?? 0;
    if (weeklyPostCount >= 5) {
      setLoading(false);
      Alert.alert('Weekly limit reached', 'You can only leave 5 marks per week. Please try again next week.');
      return;
    }

    setRemainingMarks((prev) => Math.max(prev - 1, 0));

    const payload: Record<string, any> = {
      user_id: session.user.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
      mood: selectedMood,
    };

    if (location) {
      payload.location = `${location.lat},${location.lng}`;
    }

    if (selectedImage) {
      try {
        const response = await fetch(selectedImage.uri);
        const arrayBuffer = await response.arrayBuffer();
        const fileExtension = selectedImage.uri.split('.').pop()?.toLowerCase() || 'jpg';
        const filePath = `posts/${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExtension}`;
        const contentType = getContentType(selectedImage);

        const { error: uploadError } = await supabase.storage.from('images').upload(filePath, arrayBuffer, {
          contentType,
          upsert: false,
        });

        if (uploadError) {
          setLoading(false);
          Alert.alert('Image upload failed', uploadError.message);
          return;
        }

        const { data: publicData } = supabase.storage.from('images').getPublicUrl(filePath);
        payload.image_url = publicData.publicUrl;
      } catch (uploadException) {
        setLoading(false);
        Alert.alert('Image upload failed', 'Unable to upload your image right now.');
        return;
      }
    }

    const { error } = await supabase.from('posts').insert(payload);
    setLoading(false);

    if (error) {
      Alert.alert('Post failed', error.message);
      return;
    }

    setContent('');
    setSelectedMood('nostalgic');
    setSelectedImage(null);
    Alert.alert('Posted', 'Your post was added to the Freedom Wall.');
    onClose();
    if (onPosted) onPosted();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            { backgroundColor: moodBackgroundMap[selectedMood] ?? '#5e688b' },
          ]}
        >
          <Text style={styles.title}>Leave a mark</Text>

          <TextInput
            style={styles.input}
            placeholder="What do you want to say?"
            placeholderTextColor="#94a3b8"
            value={content}
            onChangeText={setContent}
            multiline
          />

          <View style={styles.moodSection}>
            <Text style={styles.sectionLabel}>How are you feeling?</Text>
            <View style={styles.moodRow}>
              {moodOptions.map((option) => {
                const active = selectedMood === option.value;
                return (
                  <MoodOptionButton
                    key={option.value}
                    option={option}
                    active={active}
                    onPress={() => setSelectedMood(option.value)}
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.uploadArea}>
            <Pressable style={styles.uploadButton} onPress={pickImage}>
              {selectedImage ? (
                <Image source={{ uri: selectedImage.uri }} style={styles.uploadPreview} />
              ) : (
                <View style={styles.emptyUploadState}>
                  <Text style={styles.uploadText}>Add image</Text>
                  <Text style={styles.uploadHint}>Optional</Text>
                </View>
              )}
              <Text style={styles.uploadText}>{selectedImage ? 'Change image' : 'Add image'}</Text>
            </Pressable>
            {selectedImage ? (
              <Pressable style={styles.clearImageButton} onPress={clearImage}>
                <Text style={styles.clearImageText}>Clear image</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.row}>
            <Pressable style={styles.button} onPress={handleSubmit} disabled={loading || remainingMarks <= 0}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{remainingMarks > 0 ? `Post (${remainingMarks} left)` : 'Post (0 left)'}</Text>
              )}
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
    backgroundColor: 'rgba(94, 104, 139, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#5e688b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fff2f1',
  },
  title: {
    color: '#2f3a59',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    alignSelf: 'center',
  },
  input: {
    minHeight: 100,
    backgroundColor: '#fff2f1',
    color: '#5e688b',
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  moodSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    color: '#2f3a59',
    marginBottom: 8,
    fontWeight: '700',
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff2f1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  moodOptionActive: {
    backgroundColor: '#f7a7a8',
  },
  moodIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  moodLabel: {
    color: '#5e688b',
    fontSize: 12,
    fontWeight: '600',
  },
  moodLabelActive: {
    color: '#5e688b',
  },
  uploadArea: {
    marginBottom: 12,
  },
  uploadButton: {
    backgroundColor: '#fff2f1',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  emptyUploadState: {
    width: '100%',
    minHeight: 110,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffdbb7',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  uploadPreview: {
    width: '100%',
    height: 110,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  uploadText: {
    color: '#5e688b',
    marginTop: 8,
    fontWeight: '600',
  },
  uploadHint: {
    color: '#7a84a0',
    marginTop: 4,
    fontSize: 12,
  },
  clearImageButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  clearImageText: {
    color: '#fff2f1',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#f7a7a8',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancel: {
    backgroundColor: '#ffdbb7',
  },
  buttonText: {
    color: '#5e688b',
    fontWeight: '600',
  },
});
