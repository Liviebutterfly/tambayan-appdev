import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import { supabase } from '../../utils/supabase';
import { avatarOptions, getAvatarIndexFromUrl } from '../../utils/helpers';

type Props = {
  visible: boolean;
  onClose: () => void;
  userId?: string | null;
  currentLocation?: { lat: number; lng: number } | null;
};

type MemoryPost = {
  id: string | number;
  content: string;
  created_at?: string;
  location?: string | null;
  user_id?: string;
  mood?: string | null;
  image_url?: string | null;
  profiles?: { username?: string; avatar_url?: string };
};

const moodBackgroundMap: Record<string, string> = {
  nostalgic: '#c1dae0',
  peaceful: '#cef0db',
  romantic: '#f7e4ea',
  motivational: '#f2f0d8',
};

function parseLocation(location?: string | null) {
  if (!location) return null;
  const parts = String(location).split(',');
  if (parts.length < 2) return null;

  const lat = Number.parseFloat(parts[0]);
  const lng = Number.parseFloat(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  return { lat, lng };
}

export default function MemoryMapView({ visible, onClose, userId, currentLocation }: Props) {
  const [posts, setPosts] = useState<MemoryPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMapPostId, setActiveMapPostId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !userId) {
      setPosts([]);
      setError(null);
      return;
    }

    const loadPosts = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(username, avatar_url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);

      setLoading(false);

      if (error) {
        console.warn('load memories error', error);
        setError('Unable to load your memories right now.');
        setPosts([]);
        return;
      }

      setPosts((data ?? []) as MemoryPost[]);
    };

    loadPosts();
  }, [visible, userId]);

  const listPosts = posts
    .slice()
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

  const activeMapPost = listPosts.find((post) => String(post.id) === activeMapPostId) ?? null;

  const mapHtml = useMemo(() => {
    if (!activeMapPost) return '';

    const coords = parseLocation(activeMapPost.location);
    if (!coords) return '';

    return `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <style>
            html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0f172a; }
            #map { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #0f172a; }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <script>
            const map = L.map('map', {
              zoomControl: true,
              dragging: true,
              touchZoom: true,
              scrollWheelZoom: true,
              doubleClickZoom: true,
              boxZoom: true,
              keyboard: true,
            }).setView([${coords.lat}, ${coords.lng}], 14);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors',
            }).addTo(map);

            const markerIcon = L.icon({
              iconUrl: 'https://zsxdjjvohpivpwqitxrl.supabase.co/storage/v1/object/public/images/location-pin.png',
              iconSize: [44, 44],
              iconAnchor: [22, 22],
              popupAnchor: [0, -44],
            });

            const marker = L.marker([${coords.lat}, ${coords.lng}], { icon: markerIcon }).addTo(map);

            marker.bindPopup(${JSON.stringify('Post location')});
            marker.openPopup();

            setTimeout(() => {
              map.invalidateSize();
            }, 150);
          </script>
        </body>
      </html>`;
  }, [activeMapPost]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Your memories</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#fff2f1" />
            <Text style={styles.stateText}>Loading your memories…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : listPosts.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>No memories to show yet.</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {listPosts.map((post) => {
              const mood = String(post.mood ?? 'nostalgic');
              const username = post.profiles?.username ?? 'Anon';
              const avatarIndex = getAvatarIndexFromUrl(post.profiles?.avatar_url ?? null) ?? -1;
              const hasValidAvatar = avatarIndex >= 0 && avatarIndex < avatarOptions.length;

              return (
                <View
                  key={String(post.id)}
                  style={[
                    styles.memoryCard,
                    { backgroundColor: moodBackgroundMap[mood] ?? '#fff2f1' },
                  ]}
                >
                  <View style={styles.memoryHeaderRow}>
                    <View style={styles.memoryUserRow}>
                      {hasValidAvatar ? (
                        <Image source={avatarOptions[avatarIndex]} style={styles.memoryAvatar} />
                      ) : (
                        <View style={styles.memoryAvatarPlaceholder}>
                          <Text style={styles.avatarInitial}>{String(username).charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text style={styles.memoryUserName}>{username}</Text>
                    </View>

                    <Pressable
                      onPress={() => setActiveMapPostId(String(post.id))}
                      style={styles.locationButton}
                    >
                      <Text style={styles.locationButtonText}>View map location</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.memoryContent}>{post.content}</Text>
                  <Text style={styles.memoryMeta}>
                    Created: {post.created_at ? new Date(post.created_at).toLocaleString() : 'Unknown date'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {activeMapPost ? (
          <View style={styles.mapModalOverlay}>
            <View style={styles.mapModalCard}>
              <View style={styles.mapModalHeader}>
                <Text style={styles.mapModalTitle}>Post location</Text>
                <Pressable onPress={() => setActiveMapPostId(null)} style={styles.mapCloseButton}>
                  <Text style={styles.mapCloseText}>Close</Text>
                </Pressable>
              </View>

              <View style={styles.mapFrame}>
                <WebView
                  source={{ html: mapHtml }}
                  style={styles.webView}
                  javaScriptEnabled
                  domStorageEnabled
                  originWhitelist={['*']}
                  mixedContentMode="always"
                  startInLoadingState
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#5e688b',
    justifyContent: 'flex-start',
    padding: 0,
  },
  card: {
    flex: 1,
    backgroundColor: '#5e688b',
    padding: 16,
    minHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#fff2f1',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {},
  closeText: {
    color: '#fff2f1',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
    gap: 10,
  },
  memoryCard: {
    borderRadius: 12,
    padding: 12,
  },
  memoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  memoryUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  memoryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
  },
  memoryAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryUserName: {
    color: '#5e688b',
    fontWeight: '700',
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: '700',
  },
  memoryContent: {
    color: '#5e688b',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  locationButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#5e688b',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
    marginBottom: 6,
  },
  locationButtonText: {
    color: '#fff2f1',
    fontSize: 12,
    fontWeight: '700',
  },
  memoryMeta: {
    color: '#5e688b',
    fontSize: 12,
    marginTop: 2,
  },
  mapModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  mapModalCard: {
    backgroundColor: '#5e688b',
    borderRadius: 16,
    padding: 12,
    maxHeight: '72%',
  },
  mapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mapModalTitle: {
    color: '#fff2f1',
    fontSize: 16,
    fontWeight: '700',
  },
  mapCloseButton: {},
  mapCloseText: {
    color: '#fff2f1',
    fontWeight: '700',
  },
  mapFrame: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  webView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  stateBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  stateText: {
    color: '#fff2f1',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
  },
});
