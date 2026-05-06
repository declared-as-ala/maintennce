import { Redirect } from 'expo-router';

// Root route redirects to dashboard tab
export default function Index() {
  return <Redirect href="/(tabs)/dashboard" />;
}
