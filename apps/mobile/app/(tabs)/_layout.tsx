import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

type FeatherName = keyof typeof Feather.glyphMap;

function TabIcon(name: FeatherName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Feather name={name} color={color} size={size} />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#09090b' },
        headerTintColor: '#fff',
        tabBarStyle: { backgroundColor: '#09090b', borderTopColor: '#27272a' },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#71717a',
      }}
    >
      <Tabs.Screen name="deck" options={{ title: 'Deck', tabBarIcon: TabIcon('layers') }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: TabIcon('search') }} />
      <Tabs.Screen
        name="collection"
        options={{ title: 'Collection', tabBarIcon: TabIcon('grid') }}
      />
      <Tabs.Screen
        name="review-later"
        options={{ title: 'Review Later', tabBarIcon: TabIcon('bookmark') }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: TabIcon('user') }} />
    </Tabs>
  );
}
