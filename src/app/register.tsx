import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.replace('/');
      }
    };

    checkSession();
  }, []);

const handleRegister = async () => {
  if (!email || !password || !username) {
    Alert.alert('Missing fields', 'Please enter your email, username, and password.');
    return;
  }

  setLoading(true);

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    setLoading(false);
    Alert.alert('Registration failed', error.message);
    return;
  }

  if (!data.user) {
    setLoading(false);
    Alert.alert('Registration failed', 'No user was created.');
    return;
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.user) {
    setLoading(false);
    Alert.alert('Account created', 'Please check your email to confirm your account, then sign in.');
    router.replace('/login');
    return;
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: signInData.user.id,
    email: signInData.user.email,
    username: username.trim(),
  });

  setLoading(false);

  if (profileError) {
    Alert.alert('Profile save warning', profileError.message);
    return;
  }

  Alert.alert('Account created', 'Your profile is ready. Please sign in.');
  router.replace('/login');
};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join Tambayan and start discovering nearby plans.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#94a3b8"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#94a3b8"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#94a3b8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable style={styles.primaryButton} onPress={handleRegister} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? 'Creating account...' : 'Create account'}</Text>
        </Pressable>

        <Link href="/login" style={styles.linkText}>
          Already have an account?
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5e688b',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff2f1',
    borderRadius: 24,
    padding: 24,
  },
  title: {
    color: '#5e688b',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#7a84a0',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#ffffff',
    color: '#5e688b',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#f7a7a8',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#5e688b',
    fontWeight: '600',
  },
  linkText: {
    color: '#5e688b',
    marginTop: 16,
    textAlign: 'center',
  },
});
