import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { supabase } from '../../utils/supabase';
import { haversineDistance } from '../../utils/helpers';

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
};

type ClusteredMemory = {
  id: string;
  lat: number;
  lng: number;
  posts: MemoryPost[];
};

const defaultCenter = { lat: 14.5995, lng: 120.9842 };
const CLUSTER_RADIUS_KM = 0.3;

function parseLocation(location?: string | null) {
  if (!location) return null;
  const parts = String(location).split(',');
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export default function MemoryMapView({ visible, onClose, userId, currentLocation }: Props) {
  const [posts, setPosts] = useState<MemoryPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        .select('*')
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

  const clusters = useMemo<ClusteredMemory[]>(() => {
    const grouped: ClusteredMemory[] = [];

    posts.forEach((post) => {
      const coords = parseLocation(post.location);
      if (!coords) return;

      const existing = grouped.find((cluster) => haversineDistance(cluster.lat, cluster.lng, coords.lat, coords.lng) <= CLUSTER_RADIUS_KM);

      if (existing) {
        existing.posts.push(post);
        const nextLength = existing.posts.length;
        existing.lat = (existing.lat * (nextLength - 1) + coords.lat) / nextLength;
        existing.lng = (existing.lng * (nextLength - 1) + coords.lng) / nextLength;
      } else {
        grouped.push({
          id: String(post.id),
          lat: coords.lat,
          lng: coords.lng,
          posts: [post],
        });
      }
    });

    return grouped;
  }, [posts]);

  const mapHtml = useMemo(() => {
    const initialCenter = clusters[0] ?? currentLocation ?? defaultCenter;
    const clusterData = JSON.stringify(
      clusters.map((cluster) => ({
        id: cluster.id,
        lat: cluster.lat,
        lng: cluster.lng,
        count: cluster.posts.length,
        title: cluster.posts[0]?.content ?? 'Memory',
        list: cluster.posts.map((post) => ({
          content: post.content,
          createdAt: post.created_at,
          id: String(post.id),
        })),
      }))
    );

    const markerScript = clusters
      .map((cluster) => {
        const content = cluster.posts.length > 1
          ? ['<div class="popup-card"><h4>', cluster.posts.length, ' memories here</h4><ul>', cluster.posts.map((post) => '<li>' + String(post.content).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</li>').join(''), '</ul></div>'].join('')
          : ['<div class="popup-card"><h4>Your memory</h4><p>', String(cluster.posts[0]?.content ?? 'Memory').replace(/</g, '&lt;').replace(/>/g, '&gt;'), '</p></div>'].join('');

        return `
          const marker = L.marker([${cluster.lat}, ${cluster.lng}], { icon: pinIcon }).addTo(map);
          marker.bindPopup(${JSON.stringify(content)});
        `;
      })
      .join('\n');

    return `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <style>
            html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0f172a; }
            #map { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #0f172a; }
            body { font-family: sans-serif; }
            .leaflet-popup-content-wrapper { border-radius: 12px; }
            .popup-card { min-width: 180px; max-width: 240px; }
            .popup-card h4 { margin: 0 0 6px; font-size: 14px; color: #5e688b; }
            .popup-card p { margin: 4px 0; color: #475569; font-size: 12px; line-height: 1.4; }
            .popup-card .meta { color: #64748b; font-size: 11px; }
            .popup-card ul { margin: 6px 0 0; padding-left: 16px; }
            .popup-card li { margin-bottom: 4px; color: #334155; font-size: 12px; }
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
            }).setView([${initialCenter.lat}, ${initialCenter.lng}], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors',
            }).addTo(map);

            const pinIcon = L.icon({
              iconUrl: 'https://zsxdjjvohpivpwqitxrl.supabase.co/storage/v1/object/public/images/location-pin.png',
              iconSize: [40, 40],
              iconAnchor: [20, 20],
              popupAnchor: [0, -24],
            });

            const clusters = ${clusterData};

            ${markerScript}
          </script>
        </body>
      </html>`;
  }, [clusters, currentLocation]);

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
        ) : clusters.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>No memories to show yet.</Text>
          </View>
        ) : (
          <View style={styles.mapContainer}>
            <WebView
              source={{ html: mapHtml, baseUrl: 'https://unpkg.com' }}
              style={styles.webView}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              mixedContentMode="always"
              startInLoadingState
              onError={() => setError('Unable to display the map right now.')}
            />
          </View>
        )}
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
  mapContainer: {
    flex: 1,
    minHeight: 320,
    borderRadius: 16,
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
