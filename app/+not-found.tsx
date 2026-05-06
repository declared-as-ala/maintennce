import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { COLORS, SPACING } from '../constants/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Page introuvable</Text>
      <Link href="/(tabs)/dashboard" style={styles.link}>
        Retour au tableau de bord
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  link: {
    fontSize: 14,
    color: COLORS.accent,
  },
});
