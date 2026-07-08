import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../utils/supabase';
import { avatarOptions, getAvatarIndexFromUrl, getAvatarUrlForIndex } from '../../utils/helpers';
import FreedomWallModal from './FreedomWallModal';

type Props = {
  userId: string;
  email: string;
  onLogout: () => void;
};

type ProfilePost = {
  id: string | number;
  content: string;
  created_at?: string;
  location?: string | null;
};

export default function Profile({ userId, email, onLogout }: Props) {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [selectedAvatar, setSelectedAvatar] = useState<number | null>(null);
  const [avatarPage, setAvatarPage] = useState(0);
  const [tambayCount, setTambayCount] = useState(0);
  const [latestPosts, setLatestPosts] = useState<ProfilePost[]>([]);
  const [latestPostsLoading, setLatestPostsLoading] = useState(false);
  const [showMemories, setShowMemories] = useState(false);

  const totalPages = useMemo(() => Math.ceil(avatarOptions.length / 6), []);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('username, bio, avatar_url')
        .eq('id', userId)
        .single();
      setLoading(false);

      if (error) {
        console.warn('profile load error', error);
        return;
      }

      if (data) {
        setUsername(data.username ?? '');
        setBio(data.bio ?? '');
        setSelectedAvatar(getAvatarIndexFromUrl(data.avatar_url) ?? null);
      }
    };

    const loadUserPosts = async () => {
      setLatestPostsLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, created_at, location')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      setLatestPostsLoading(false);

      if (error) {
        console.warn('posts load error', error);
        setLatestPosts([]);
        setTambayCount(0);
        return;
      }

      const posts = (data ?? []) as ProfilePost[];
      setLatestPosts(posts.slice(0, 3));
      setTambayCount(posts.length);
    };

    loadProfile();
    loadUserPosts();
  }, [userId]);

  const saveProfile = async () => {
    setLoading(true);
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      username,
      bio,
      email,
      avatar_url: getAvatarUrlForIndex(selectedAvatar),
    });

    if (error) {
      setLoading(false);
      Alert.alert('Unable to save', error.message);
      return;
    }

    setLoading(false);
    setMode('view');
    Alert.alert('Saved', 'Your profile was updated.');
  };

  const visibleAvatars = avatarOptions.slice(avatarPage * 6, avatarPage * 6 + 6);

  if (mode === 'edit') {
    return (
      <ScrollView style={styles.profileScreen} contentContainerStyle={styles.profileContent} keyboardShouldPersistTaps="handled">
        <View style={styles.editHeader}>
          <Pressable style={styles.backButton} onPress={() => setMode('view')}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <Text style={styles.profileTitle}>Edit profile</Text>
        </View>

        <View style={styles.avatarSection}>
          <Text style={styles.sectionLabel}>Choose an avatar</Text>
          <View style={styles.avatarGrid}>
            {visibleAvatars.map((avatarSource, index) => {
              const absoluteIndex = avatarPage * 6 + index;
              const isActive = selectedAvatar === absoluteIndex;

              return (
                <Pressable
                  key={absoluteIndex}
                  style={[styles.avatarOption, isActive && styles.avatarOptionActive]}
                  onPress={() => setSelectedAvatar(absoluteIndex)}
                >
                  <Image source={avatarSource} style={styles.avatarImage} />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.paginationRow}>
            <Pressable
              style={[styles.paginationButton, avatarPage === 0 && styles.paginationButtonDisabled]}
              onPress={() => setAvatarPage((page) => Math.max(0, page - 1))}
              disabled={avatarPage === 0}
            >
              <Text style={styles.paginationButtonText}>Previous</Text>
            </Pressable>
            <Text style={styles.paginationText}>{avatarPage + 1} / {totalPages}</Text>
            <Pressable
              style={[styles.paginationButton, avatarPage === totalPages - 1 && styles.paginationButtonDisabled]}
              onPress={() => setAvatarPage((page) => Math.min(totalPages - 1, page + 1))}
              disabled={avatarPage === totalPages - 1}
            >
              <Text style={styles.paginationButtonText}>Next</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.profileBody}>
          <Text style={styles.sectionLabel}>Username</Text>
          <TextInput
            style={styles.profileInput}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.sectionLabel}>Bio</Text>
          <TextInput
            style={[styles.profileInput, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Write something about yourself"
            placeholderTextColor="#94a3b8"
            multiline
          />

          <Pressable style={styles.saveButton} onPress={saveProfile} disabled={loading}>
            <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Profile'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.profileScreen} contentContainerStyle={styles.profileContent} keyboardShouldPersistTaps="handled">
      <View style={styles.profileHeader}>
        <View style={styles.avatarPlaceholder}>
          {selectedAvatar !== null ? (
            <Image source={avatarOptions[selectedAvatar]} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{email?.charAt(0).toUpperCase() || 'A'}</Text>
          )}
        </View>
        <Text style={styles.profileName}>{username || 'Your Name'}</Text>
        <Text style={styles.profileEmail}>{email}</Text>
        <View style={styles.tambayBadge}>
          <Text style={styles.tambayValue}>{tambayCount}</Text>
          <Text style={styles.tambayLabel}>tambays</Text>
        </View>
      </View>

      <View style={styles.profileBody}>
        <Text style={styles.sectionLabel}>About</Text>
        <Text style={styles.profileAbout}>{bio || 'Tap edit to add a short bio.'}</Text>

        <View style={styles.latestPostsCard}>
          <Text style={styles.sectionLabel}>Latest posts</Text>
          {latestPostsLoading ? (
            <ActivityIndicator color="#60a5fa" style={{ marginTop: 8 }} />
          ) : latestPosts.length > 0 ? (
            latestPosts.map((post) => (
              <View key={post.id} style={styles.latestPostItem}>
                <Text style={styles.latestPostContent} numberOfLines={2}>
                  {post.content || 'No caption'}
                </Text>
                <Text style={styles.latestPostMeta}>
                  {post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No posts yet.</Text>
          )}

          <Pressable style={styles.memoriesButton} onPress={() => setShowMemories(true)}>
            <Text style={styles.memoriesButtonText}>View memories</Text>
          </Pressable>
        </View>

        <Pressable style={styles.editButton} onPress={() => setMode('edit')}>
          <Text style={styles.editButtonText}>Edit profile</Text>
        </Pressable>
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutButtonText}>Log out</Text>
        </Pressable>
      </View>

      <FreedomWallModal
        visible={showMemories}
        onClose={() => setShowMemories(false)}
        currentLocation={null}
        filterUserId={userId}
        readOnly
        showMapView
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  profileScreen: {
    flex: 1,
    backgroundColor: '#5e688b',
  },
  profileContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 120,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fff2f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarText: {
    color: '#5e688b',
    fontSize: 32,
    fontWeight: '700',
  },
  profileName: {
    color: '#fff2f1',
    fontSize: 22,
    fontWeight: '700',
  },
  profileEmail: {
    color: '#ffdbb7',
    marginTop: 6,
  },
  tambayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff2f1',
  },
  tambayValue: {
    color: '#5e688b',
    fontSize: 16,
    fontWeight: '700',
  },
  tambayLabel: {
    color: '#7a84a0',
    fontSize: 13,
    fontWeight: '600',
  },
  profileBody: {
    flex: 1,
  },
  profileAbout: {
    color: '#fff2f1',
    fontSize: 15,
    lineHeight: 22,
  },
  latestPostsCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#fff2f1',
  },
  latestPostItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  latestPostContent: {
    color: '#5e688b',
    fontSize: 14,
    lineHeight: 20,
  },
  latestPostMeta: {
    color: '#7a84a0',
    fontSize: 12,
    marginTop: 4,
  },
  emptyText: {
    color: '#7a84a0',
    fontSize: 13,
    marginTop: 6,
  },
  memoriesButton: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#f7a7a8',
  },
  memoriesButtonText: {
    color: '#5e688b',
    fontWeight: '600',
  },
  sectionLabel: {
    color: '#7a84a0',
    marginTop: 12,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  profileInput: {
    backgroundColor: '#fff2f1',
    color: '#5e688b',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
  },
  bioInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  editButton: {
    marginTop: 20,
    backgroundColor: '#f7a7a8',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#5e688b',
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: '#f7a7a8',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#5e688b',
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 12,
    backgroundColor: '#ffdbb7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#5e688b',
    fontWeight: '600',
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#fff2f1',
  },
  backButtonText: {
    color: '#5e688b',
    fontWeight: '600',
  },
  profileTitle: {
    color: '#fff2f1',
    fontSize: 18,
    fontWeight: '700',
  },
  avatarSection: {
    marginBottom: 16,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  avatarOption: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#fff2f1',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOptionActive: {
    borderWidth: 2,
    borderColor: '#f7a7a8',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  paginationButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#fff2f1',
  },
  paginationButtonDisabled: {
    opacity: 0.45,
  },
  paginationButtonText: {
    color: '#5e688b',
    fontWeight: '600',
  },
  paginationText: {
    color: '#ffdbb7',
    fontWeight: '600',
  },
});