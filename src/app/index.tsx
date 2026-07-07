import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { supabase } from '../../utils/supabase';
import { avatarOptions, getAvatarIndexFromUrl, oneWeekAgo, getAvatarUrlForIndex, haversineDistance } from '../../utils/helpers';
import FreedomWallModal from '../components/FreedomWallModal';
import LeavePostModal from '../components/LeavePostModal';
import Profile from '../components/Profile';

type TabKey = 'map' | 'profile';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'map', label: 'Map' },
  { key: 'profile', label: 'Profile' },
];

const defaultCenter = { lat: 14.5995, lng: 120.9842 };

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('map');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState('Finding your area...');
  const [showWall, setShowWall] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<number | null>(null);
  const [tambayCount, setTambayCount] = useState(0);

  
  useEffect(() => {
    const loadProfileAvatar = async () => {
      if (!userId) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single();

      if (!error && data?.avatar_url) {
        const avatarIndex = getAvatarIndexFromUrl(data.avatar_url);
        if (avatarIndex !== null) {
          setSelectedAvatar(avatarIndex);
        }
      } else {
        setSelectedAvatar(null);
      }
    };

    const loadTambayCount = async () => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('posts')
        .select('location')
        .gte('created_at', oneWeekAgo());
      if (!error) {
        let tambayCount = 0;
        data.forEach(tambay => {
          if (tambay.location){
            const parts = String(tambay.location).split(',');
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if(parts.length===2&&currentLocation && !isNaN(lat) && !isNaN(lng)){
              if (haversineDistance(currentLocation.lat, currentLocation.lng, lat, lng) <= 1) tambayCount++;
            }
          }
        });
        setTambayCount(tambayCount);
      }
    };

    loadProfileAvatar();
    loadTambayCount();
  }, [activeTab, userId, currentLocation]);

  const mapHtml = useMemo(() => {
    const lat = currentLocation?.lat ?? defaultCenter.lat;
    const lng = currentLocation?.lng ?? defaultCenter.lng;

    return `<!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                <style>
                  html, body, #map { margin: 0; height: 100%; width: 100%; overflow: hidden; }
                  body { font-family: sans-serif; }
                </style>
              </head>
              <body>
                <div id="map"></div>
                <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                <script>
                  const map = L.map('map', {
                    zoomControl: false,
                    dragging: false,
                    touchZoom: false,
                    scrollWheelZoom: false,
                    doubleClickZoom: false,
                    boxZoom: false,
                    keyboard: false,
                  }).setView([${lat}, ${lng}], 15);

                  L.control.zoom({ position: 'bottomright' }).addTo(map);

                  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors',
                  }).addTo(map);

                  const markerIconUrl = 'https://zsxdjjvohpivpwqitxrl.supabase.co/storage/v1/object/public/images/location-pin.png';
                  const markerIcon = L.icon({
                    iconUrl: markerIconUrl,
                    iconSize: [44, 44],
                    iconAnchor: [22, 22],
                    popupAnchor: [0, -44],
                  });

                  L.marker([${lat}, ${lng}], { icon: markerIcon }).addTo(map);

                  const radius = L.circle([${lat}, ${lng}], {
                    radius: 100,
                    color: '#f7a7a8',
                    fillColor: '#f7a7a8',
                    fillOpacity: 0.15,
                  }).addTo(map);
                </script>
              </body>
            </html>`;
  }, [currentLocation]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session) {
        router.replace('/login');
        return;
      }
      setEmail(session.user.email ?? '');
      setUserId(session.user.id);
      setLoading(false);
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        router.replace('/login');
      } else {
        setEmail(session.user.email ?? '');
        setUserId(session.user.id);
        setLoading(false);
      }
    });

    return () => {
      // this is like the cleanup function 
      // runs when homescreen (this screen) unmounts
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted');
        setLocationName('Location unavailable');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      setCurrentLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
    };

    if (activeTab === 'map') {
      loadLocation();
    }
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;

    const resolveLocationName = async () => {
      if (!currentLocation) {
        setLocationName('Finding your area...');
        return;
      }

      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
        });

        if (cancelled) return;

        const placeName = [address?.name, address?.street, address?.city, address?.region]
          .filter(Boolean)
          .join(', ');

        setLocationName(placeName ? `${placeName}` : 'Nearby area');
      } catch (error) {
        if (!cancelled) {
          setLocationName('Nearby area');
        }
      }
    };

    resolveLocationName();

    return () => {
      cancelled = true;
    };
  }, [currentLocation]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Logout failed', error.message);
      return;
    }
    router.replace('/login');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {activeTab === 'profile' ? (
        <Profile userId={userId!} email={email} onLogout={handleLogout} />
      ) : (
        <View style={styles.mapScreen}>
          <WebView
            key={`${currentLocation?.lat ?? defaultCenter.lat}-${currentLocation?.lng ?? defaultCenter.lng}`}
            source={{ html: mapHtml }}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
          />

          <View style={styles.mapFloatingProfile}>
              {selectedAvatar !== null ? (
                <Image source={avatarOptions[selectedAvatar]} style={styles.mapProfileImage} />
              ) : (
                <Text style={styles.mapProfileInitial}>{email?.charAt(0).toUpperCase() || 'A'}</Text>
              )}
          </View>
          
  
          <View style={styles.cardContainer}>
            <View style={styles.locationInfo}>
              <Text style={styles.cardText}>{locationName}</Text>
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.wallButton} onPress={() => setShowWall(true)}>
                <Text style={styles.tambayCountText}>{tambayCount}</Text>
                <Text style={styles.cardText}>people have tambayed here this week!</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.postButton} onPress={() => setShowLeave(true)}>
              <Text style={styles.cardText}>Leave a mark!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabButton, isActive && styles.activeTabButton]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FreedomWallModal visible={showWall} onClose={() => setShowWall(false)} currentLocation={currentLocation} radiusKm={1} />
      <LeavePostModal visible={showLeave} onClose={() => setShowLeave(false)} onPosted={() => setShowWall(true)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  mapScreen: {
    flex: 1,
    backgroundColor: '#1e293b',
  },
  profileScreen: {
    flex: 1,
    padding: 20,
    backgroundColor: '#0f172a',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '700',
  },
  profileName: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
  },
  profileEmail: {
    color: '#94a3b8',
    marginTop: 6,
  },
  profileBody: {
    flex: 1,
  },
  sectionLabel: {
    color: '#94a3b8',
    marginTop: 12,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  profileInput: {
    backgroundColor: '#111c2f',
    color: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
  },
  bioInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 12,
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  mapFloatingProfile: {
    position: 'absolute',
    left: -10,
    bottom: 0,
    zIndex: 2,
  },
  mapProfileImage: {
    resizeMode: 'contain',
    width: 208,
    height: 208,
    
  },
  mapProfileInitial: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
  },
  cardContainer: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    backgroundColor: '#5e688b',
    borderWidth:2,
    borderColor:'#37405f',
    borderRadius: 16,
    padding: 16,
    zIndex: 1,
    gap: 10,
  },
  locationInfo: {
    paddingBottom: 4,
    backgroundColor: '#fff2f1',
    height: 30,
    borderRadius: 999,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  wallButton: {
    backgroundColor: '#fff2f1',
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    width: '50%',
  },
  postButton: {
    backgroundColor: '#fff2f1',
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    width: '50%',
  },
  tambayCountText: {
    color: '#000',
    fontSize:25,
    fontWeight: '700',
  },
  cardText: {
    color: '#000',
    fontSize: 16,
    fontWeight:'light',
    textAlign: 'center',
  },
  webView: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 18,
    backgroundColor: '#111827',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#1f2937',
  },
  activeTabButton: {
    backgroundColor: '#2563eb',
  },
  tabLabel: {
    color: '#e5e7eb',
    fontWeight: '600',
  },
  activeTabLabel: {
    color: '#ffffff',
  },
  profileSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 90,
    backgroundColor: '#111c2f',
    borderRadius: 20,
    padding: 16,
  },
  profileTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  profileEmailSmall: {
    color: '#94a3b8',
    marginTop: 6,
  },
});
