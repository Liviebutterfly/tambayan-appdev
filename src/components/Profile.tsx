import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../utils/supabase';
import { avatarOptions, getAvatarIndexFromUrl, getAvatarUrlForIndex } from '../../utils/helpers';

type Props = {
  userId: string;
  email: string;
  onLogout: () => void;
};

export default function Profile({ userId, email, onLogout }: Props) {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [selectedAvatar, setSelectedAvatar] = useState<number | null>(null);
  const [avatarPage, setAvatarPage] = useState(0);

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

    loadProfile();
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
      <View style={styles.profileScreen}>
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
      </View>
    );
  }

  return (
    <View style={styles.profileScreen}>
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
      </View>

      <View style={styles.profileBody}>
        <Text style={styles.sectionLabel}>About</Text>
        <Text style={styles.profileAbout}>{bio || 'Tap edit to add a short bio.'}</Text>

        <Pressable style={styles.editButton} onPress={() => setMode('edit')}>
          <Text style={styles.editButtonText}>Edit profile</Text>
        </Pressable>
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutButtonText}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
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
  profileAbout: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
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
  editButton: {
    marginTop: 20,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#ffffff',
    fontWeight: '600',
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
    backgroundColor: '#1e293b',
  },
  backButtonText: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  profileTitle: {
    color: '#f8fafc',
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
    backgroundColor: '#111c2f',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOptionActive: {
    borderWidth: 2,
    borderColor: '#60a5fa',
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
    backgroundColor: '#1e293b',
  },
  paginationButtonDisabled: {
    opacity: 0.45,
  },
  paginationButtonText: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  paginationText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
});