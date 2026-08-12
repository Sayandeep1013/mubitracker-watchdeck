import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const [username, setUsername] = useState('');
  const router = useRouter();

  useEffect(() => {
    apiClient.getProfile().then((p) => setUsername(p.username)).catch(() => router.replace('/login'));
  }, []);

  const exportData = async () => {
    const data = await apiClient.exportData();
    Alert.alert('Exported', `${data.media.length} items ready (copy via web for file download)`);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.username}>@{username}</Text>
      <Pressable style={styles.btn} onPress={exportData}>
        <Text style={styles.btnText}>Export</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={signOut}>
        <Text style={styles.btnText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', padding: 16 },
  username: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 24 },
  btn: { backgroundColor: '#27272a', padding: 16, borderRadius: 8, marginBottom: 12 },
  btnText: { color: '#fff', textAlign: 'center' },
});
