import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '@/lib/api';

export default function WriteReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [body, setBody] = useState('');
  const router = useRouter();

  const save = async () => {
    if (!body.trim() || !id) return;
    await apiClient.createReview({ media_id: id, body: body.trim() });
    router.back();
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        placeholder="Your review…"
        placeholderTextColor="#71717a"
        style={styles.input}
      />
      <Pressable style={styles.btn} onPress={save}>
        <Text style={styles.btnText}>Save</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', padding: 16 },
  input: { flex: 1, backgroundColor: '#18181b', borderRadius: 8, padding: 16, color: '#fff', textAlignVertical: 'top' },
  btn: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginTop: 16 },
  btnText: { color: '#000', textAlign: 'center', fontWeight: '600' },
});
