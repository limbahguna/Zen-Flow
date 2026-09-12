import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  useListMoods,
  useCreateMood,
  getListMoodsQueryKey,
} from "@workspace/api-client-react";

const MOODS = [
  { key: "great", label: "Great", score: 5 },
  { key: "good", label: "Good", score: 4 },
  { key: "okay", label: "Okay", score: 3 },
  { key: "low", label: "Low", score: 2 },
  { key: "rough", label: "Rough", score: 1 },
] as const;

type MoodKey = (typeof MOODS)[number]["key"];

export default function MoodScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session, loading } = useAuth();
  const queryClient = useQueryClient();

  const hasActiveSession = Boolean(session?.access_token);
  const [selected, setSelected] = useState<MoodKey | null>(null);
  const [note, setNote] = useState("");

  const { data: moods, isLoading } = useListMoods(
    { query: { enabled: hasActiveSession && !loading, queryKey: getListMoodsQueryKey() } },
  );

  const createMood = useCreateMood();

  const handleLog = () => {
    if (!selected) return;
    if (!hasActiveSession) {
      Alert.alert("Session expired", "Please sign in again to log a mood.");
      return;
    }
    const moodObj = MOODS.find((m) => m.key === selected)!;
    createMood.mutate(
      { data: { mood: selected, score: moodObj.score, note: note.trim() || null } },
      {
        onSuccess: () => {
          setSelected(null);
          setNote("");
          queryClient.invalidateQueries({ queryKey: getListMoodsQueryKey() });
        },
        onError: () => Alert.alert("Error", "Could not log mood."),
      },
    );
  };

  const moodColors: Record<MoodKey, string> = {
    great: colors.great ?? "#22C55E",
    good: "#84CC16",
    okay: colors.okay ?? "#EAB308",
    low: "#F97316",
    rough: colors.destructive,
  };

  const s = makeStyles(colors, insets);

  const recentMoods = [...(moods ?? [])].reverse().slice(0, 7);

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.title}>Mood Tracker</Text>
      <Text style={s.sub}>How are you feeling right now?</Text>

      <View style={s.moodGrid}>
        {MOODS.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[
              s.moodChip,
              { borderColor: moodColors[m.key] },
              selected === m.key && { backgroundColor: moodColors[m.key] },
            ]}
            onPress={() => setSelected(m.key)}
            testID={`button-mood-${m.key}`}
          >
            <Text style={[s.moodChipText, selected === m.key && { color: "#fff" }]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selected && (
        <>
          <Text style={s.noteLabel}>Add a note (optional)</Text>
          <TextInput
            style={s.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            testID="input-mood-note"
          />
        </>
      )}

      <TouchableOpacity
        style={[s.logBtn, (!selected || createMood.isPending) && s.logBtnDisabled]}
        onPress={handleLog}
        disabled={!selected || createMood.isPending}
        testID="button-log-mood"
      >
        {createMood.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.logBtnText}>Log Mood</Text>
        )}
      </TouchableOpacity>

      <Text style={s.sectionTitle}>Recent Entries</Text>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : recentMoods.length === 0 ? (
        <Text style={s.emptyText}>No mood entries yet.</Text>
      ) : (
        recentMoods.map((m) => (
          <View key={m.id} style={s.entryCard} testID={`card-mood-${m.id}`}>
            <View style={[s.moodDot, { backgroundColor: moodColors[m.mood as MoodKey] }]} />
            <View style={s.entryInfo}>
              <Text style={s.entryMood}>{m.mood.charAt(0).toUpperCase() + m.mood.slice(1)}</Text>
              {m.note ? <Text style={s.entryNote} numberOfLines={1}>{m.note}</Text> : null}
              <Text style={s.entryDate}>{new Date(m.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  const botPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 100;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 20 },
    title: { fontFamily: "Nunito_700Bold", fontSize: 28, color: colors.foreground, marginBottom: 4 },
    sub: { fontFamily: "Inter_400Regular", fontSize: 15, color: colors.mutedForeground, marginBottom: 24 },
    moodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
    moodChip: {
      paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100,
      borderWidth: 2, backgroundColor: colors.card,
    },
    moodChipText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.foreground },
    noteLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: colors.mutedForeground, marginBottom: 8 },
    noteInput: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      fontFamily: "Inter_400Regular", fontSize: 15, color: colors.foreground,
      marginBottom: 20, textAlignVertical: "top", minHeight: 80,
    },
    logBtn: {
      backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14,
      alignItems: "center", marginBottom: 32,
    },
    logBtnDisabled: { opacity: 0.4 },
    logBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
    sectionTitle: { fontFamily: "Nunito_600SemiBold", fontSize: 17, color: colors.foreground, marginBottom: 12 },
    emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, color: colors.mutedForeground },
    entryCard: {
      flexDirection: "row", alignItems: "flex-start", gap: 12,
      backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10,
    },
    moodDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
    entryInfo: { flex: 1 },
    entryMood: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: colors.foreground },
    entryNote: { fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    entryDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
  });
}
