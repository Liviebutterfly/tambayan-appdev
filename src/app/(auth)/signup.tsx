import { supabase } from '../../../utils/supabase';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function SignUpScreen() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSignUp() {
        if (!username || !email || !password || !confirmPassword) {
            Alert.alert('Please complete all fields.');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Passwords do not match.');
            return;
        }

        if (!acceptedTerms) {
            Alert.alert('Please accept the terms and privacy policy.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                username: username,
                }
            }
        });

        if (!error) {
            // Manually insert into profiles in case the DB trigger isn't set up
            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user) {
                await supabase.from('profiles').upsert({
                    id: userData.user.id,
                    username: username,
                });
            }
        }
        setLoading(false);

        if (error) {
            Alert.alert(error.message);
            return;
        }

        Alert.alert('Account created!', 'Please check your email to verify your account.');
        router.push('./login');
    }

    return (
        <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.content}>
                <View style={styles.pinWrapper}>
                    <Image 
                        source={require('@/assets/images/T.png')} 
                        style={styles.logoImage}
                        contentFit="contain"
                    />
                </View>

                <Text style={styles.heading}>Sign Up</Text>

                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Username</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Username"
                        placeholderTextColor="#7a7a7a"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        textContentType="username"
                    />
                </View>

                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#7a7a7a"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        textContentType="emailAddress"
                    />
                </View>

                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#7a7a7a"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        textContentType="newPassword"
                    />
                </View>

                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Confirm Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Confirm Password"
                        placeholderTextColor="#7a7a7a"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        textContentType="password"
                    />
                </View>

                <TouchableOpacity
                    style={styles.termsRow}
                    onPress={() => setAcceptedTerms((current) => !current)}
                    activeOpacity={0.8}
                >
                    <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                        {acceptedTerms ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.termsText}>I accept the terms and privacy policy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, loading && styles.buttonDisabled]}
                    onPress={handleSignUp}
                    activeOpacity={0.9}
                    disabled={loading}
                >
                    <Text style={styles.actionText}>Sign Up</Text>
                </TouchableOpacity>

                <Text style={styles.footerText}>
                    Already have an account?{' '}
                    <Text style={styles.linkText} onPress={() => router.push('./login')}>
                        Sign in
                    </Text>
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
  },
  pinWrapper: {
    marginBottom: 20,
    alignItems: 'center',
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  fieldGroup: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#d9d9d9',
    paddingHorizontal: 16,
    color: '#000',
  },
  termsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#000',
  },
  checkMark: {
    color: '#fff',
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#000',
  },
  actionButton: {
    marginTop: 34,
    width: '90%',
    maxWidth: 280,
    height: 52,
    backgroundColor: '#f7a7a8',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footerText: {
    marginTop: 22,
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
  },
  linkText: {
    color: '#f7a7a8',
    fontWeight: '700',
  },
});