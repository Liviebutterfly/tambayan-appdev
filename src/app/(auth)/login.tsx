import { supabase } from '../../../utils/supabase';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleLogin() {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        setLoading(false);

        if (error) {
            Alert.alert('Login Failed', error.message);
            return;
        }
        router.replace('/');
    }

    return (
        <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
            <Stack.Screen options={{ title: 'Login', headerShown: false }} />
            <View style={styles.content}>
                <View style={styles.pinWrapper}>
                    <Image 
                        source={require('@/assets/images/T.png')} 
                        style={styles.logoImage}
                        contentFit="contain"
                    />
                </View>

                <Text style={styles.heading}>Login</Text>

                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your email"
                        placeholderTextColor="#7a7a7a"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                </View>

                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your password"
                        placeholderTextColor="#7a7a7a"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity
                    style={[styles.actionButton, loading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    <Text style={styles.actionText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
                </TouchableOpacity>

                <Text style={styles.footerText}>
                    Don't have an account?{' '}
                    <Text style={styles.linkText} onPress={() => router.push('./signup')}>
                        Sign up
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
        paddingHorizontal: 20,
    },
    content: {
        alignItems: 'center',
    },
    pinWrapper: {
        marginBottom: 20,
    },
    logoImage: {
        width: 120,
        height: 120,
    },
    heading: {
        fontSize: 32,
        fontWeight: '700',
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
        marginBottom: 8,
    },
    input: {
        height: 48,
        borderRadius: 12,
        backgroundColor: '#d9d9d9',
        paddingHorizontal: 16,
    },
    actionButton: {
        marginTop: 34,
        width: '90%',
        height: 52,
        backgroundColor: '#f7a7a8',
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionText: { fontSize: 18, fontWeight: '600' },
    buttonDisabled: { opacity: 0.6 },
    footerText: { marginTop: 22, fontSize: 12 },
    linkText: { color: '#f7a7a8', fontWeight: '700' },
});