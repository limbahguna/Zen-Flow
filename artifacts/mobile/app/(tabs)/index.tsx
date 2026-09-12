import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  useGetTaskSummary,
  useListMoods,
  getGetTaskSummaryQueryKey,
  getListMoodsQueryKey,
} from "@workspace/api-client-react";

const MOOD_LABELS: Record<string, string> = {
  great: "Great",
  good: "Good",
  okay: "Okay",
  low: "Low",
  rough: "Rough",
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, session, loading, signOut } = useAuth();
  const router = useRouter();

  const hasActiveSession = Boolean(session?.access_token);

  const { data: summary } = useGetTaskSummary(
    { query: { enabled: hasActiveSession && !loading, queryKey: getGetTaskSummaryQueryKey() } },
  );

  const { data: moods } = useListMoods(
    { query: { enabled: hasActiveSession && !loading, queryKey: getListMoodsQueryKey() } },
  );

  const latestMood = moods && moods.length > 0 ? moods[moods.length - 1] : null;

  const firstName = user?.email?.split("@")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const s = makeStyles(colors, insets);

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.topBar}>
        <View>
          <Text style={s.greeting}>{greeting},</Text>
          <Text style={s.name}>{firstName}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={s.logoutBtn} testID="button-logout">
          <Feather name="log-out" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>Today's Overview</Text>
      <View style={s.statsRow}>
        {[
          { label: "Pending", value: summary?.pending ?? 0, color: colors.okay },
          { label: "In Progress", value: summary?.in_progress ?? 0, color: colors.primary },
          { label: "Done", value: summary?.completed ?? 0, color: colors.great },
        ].map((stat) => (
          <View key={stat.label} style={[s.statCard, { borderTopColor: stat.color }]}>
            <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <Text style={s.sectionTitle}>How are you feeling?</Text>
      {latestMood ? (
        <View style={s.moodCard}>
          <Text style={s.moodEmoji}>
            {latestMood.mood === "great" ? "Excellent" :
             latestMood.mood === "good" ? "Good" :
             latestMood.mood === "okay" ? "Alright" :
             latestMood.mood === "low" ? "Low energy" : "Struggling"}
          </Text>
          <Text style={s.moodSub}>Last logged: {MOOD_LABELS[latestMood.mood]}</Text>
          {latestMood.note ? <Text style={s.moodNote}>"{latestMood.note}"</Text> : null}
          <TouchableOpacity
            style={s.moodLink}
            onPress={() => router.push("/(tabs)/mood")}
            testID="link-log-mood"
          >
            <Text style={s.moodLinkText}>Log today's mood</Text>
            <Feather name="arrow-right" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={s.moodEmpty}
          onPress={() => router.push("/(tabs)/mood")}
          testID="button-log-mood"
        >
          <Feather name="heart" size={28} color={colors.primary} />
          <Text style={s.moodEmptyText}>Log how you're feeling today</Text>
          <Feather name="arrow-right" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}

      <Text style={s.sectionTitle}>Quick Actions</Text>
      <View style={s.quickRow}>
        <TouchableOpacity
          style={s.quickBtn}
          onPress={() => router.push("/(tabs)/tasks")}
          testID="link-tasks"
        >
          <Feather name="check-square" size={22} color={colors.primary} />
          <Text style={s.quickBtnText}>View Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.quickBtn}
          onPress={() => router.push("/(tabs)/mood")}
          testID="link-mood"
        >
          <Feather name="heart" size={22} color={colors.primary} />
          <Text style={s.quickBtnText}>Track Mood</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  const botPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 100;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 20 },
    topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
    greeting: { fontFamily: "Inter_400Regular", fontSize: 15, color: colors.mutedForeground },
    name: { fontFamily: "Nunito_700Bold", fontSize: 26, color: colors.foreground, marginTop: 2 },
    logoutBtn: { padding: 8 },
    sectionTitle: { fontFamily: "Nunito_600SemiBold", fontSize: 17, color: colors.foreground, marginBottom: 12 },
    statsRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
    statCard: {
      flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 16,
      borderTopWidth: 3, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    statValue: { fontFamily: "Nunito_700Bold", fontSize: 28, marginBottom: 2 },
    statLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground },
    moodCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 20,
      marginBottom: 28, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    moodEmoji: { fontFamily: "Nunito_700Bold", fontSize: 22, color: colors.foreground },
    moodSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground, marginTop: 4 },
    moodNote: { fontFamily: "Inter_400Regular", fontSize: 14, color: colors.foreground, marginTop: 8, fontStyle: "italic" },
    moodLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 12 },
    moodLinkText: { fontFamily: "Inter_500Medium", fontSize: 14, color: colors.primary },
    moodEmpty: {
      backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 28,
      flexDirection: "row", alignItems: "center", gap: 12,
      shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    moodEmptyText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15, color: colors.foreground },
    quickRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
    quickBtn: {
      flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 18,
      alignItems: "center", gap: 8,
      shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    quickBtnText: { fontFamily: "Inter_500Medium", fontSize: 14, color: colors.foreground },
  });
}
