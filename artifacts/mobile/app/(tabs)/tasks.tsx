import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getListTasksQueryKey,
  getGetTaskSummaryQueryKey,
} from "@workspace/api-client-react";
import type { Task } from "@workspace/api-client-react";

const PRIORITY_COLORS: Record<string, string> = { low: "#22C55E", medium: "#EAB308", high: "#EF4444" };
const STATUS_LABELS: Record<string, string> = { pending: "Pending", in_progress: "In Progress", completed: "Done" };

export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session, loading } = useAuth();
  const queryClient = useQueryClient();

  const hasActiveSession = Boolean(session?.access_token);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");

  const { data: tasks, isLoading } = useListTasks(
    undefined,
    { query: { enabled: hasActiveSession && !loading, queryKey: getListTasksQueryKey() } },
  );

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTaskSummaryQueryKey() });
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    if (!hasActiveSession) {
      Alert.alert("Session expired", "Please sign in again to create a task.");
      return;
    }
    createTask.mutate(
      { data: { title: newTitle.trim(), status: "pending", priority: newPriority } },
      {
        onSuccess: () => { setNewTitle(""); setShowAdd(false); invalidate(); },
        onError: () => Alert.alert("Error", "Could not create task."),
      },
    );
  };

  const toggleStatus = (task: Task) => {
    if (!hasActiveSession) {
      Alert.alert("Session expired", "Please sign in again to update a task.");
      return;
    }
    const next = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "completed" : "pending";
    updateTask.mutate(
      { id: task.id, data: { status: next } },
      { onSuccess: invalidate },
    );
  };

  const handleDelete = (id: string) => {
    if (!hasActiveSession) {
      Alert.alert("Session expired", "Please sign in again to delete a task.");
      return;
    }
    Alert.alert("Delete task", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => deleteTask.mutate({ id }, { onSuccess: invalidate }),
      },
    ]);
  };

  const s = makeStyles(colors, insets);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.title}>Tasks</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)} testID="button-add-task">
          <Feather name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={tasks ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(tasks && tasks.length > 0)}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="check-circle" size={40} color={colors.border} />
              <Text style={s.emptyText}>No tasks yet. Add one!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[s.taskCard, item.status === "completed" && s.taskDone]} testID={`card-task-${item.id}`}>
              <TouchableOpacity onPress={() => toggleStatus(item)} style={s.checkbox} testID={`button-toggle-${item.id}`}>
                <View style={[s.checkCircle, item.status === "completed" && s.checkDone]}>
                  {item.status === "completed" && <Feather name="check" size={14} color="#fff" />}
                  {item.status === "in_progress" && <View style={s.checkInner} />}
                </View>
              </TouchableOpacity>
              <View style={s.taskInfo}>
                <Text style={[s.taskTitle, item.status === "completed" && s.taskTitleDone]} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={s.taskMeta}>
                  <View style={[s.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] }]} />
                  <Text style={s.taskStatus}>{STATUS_LABELS[item.status]}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.deleteBtn} testID={`button-delete-${item.id}`}>
                <Feather name="trash-2" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowAdd(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={s.sheetTitle}>New Task</Text>
          <TextInput
            style={s.sheetInput}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="What needs to be done?"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            testID="input-task-title"
          />
          <Text style={s.sheetLabel}>Priority</Text>
          <View style={s.priorityRow}>
            {(["low", "medium", "high"] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[s.priorityBtn, newPriority === p && { backgroundColor: PRIORITY_COLORS[p] }]}
                onPress={() => setNewPriority(p)}
                testID={`button-priority-${p}`}
              >
                <Text style={[s.priorityBtnText, newPriority === p && { color: "#fff" }]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[s.submitBtn, (!newTitle.trim() || createTask.isPending) && s.submitBtnDisabled]}
            onPress={handleAdd}
            disabled={!newTitle.trim() || createTask.isPending}
            testID="button-submit-task"
          >
            {createTask.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitBtnText}>Add Task</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingTop: topPad, paddingHorizontal: 20, paddingBottom: 16,
    },
    title: { fontFamily: "Nunito_700Bold", fontSize: 28, color: colors.foreground },
    addBtn: {
      backgroundColor: colors.primary, width: 40, height: 40,
      borderRadius: 20, alignItems: "center", justifyContent: "center",
    },
    list: { paddingHorizontal: 20, paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 100 },
    empty: { alignItems: "center", paddingTop: 60, gap: 12 },
    emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: colors.mutedForeground },
    taskCard: {
      flexDirection: "row", alignItems: "center", backgroundColor: colors.card,
      borderRadius: 14, padding: 14, marginBottom: 10,
      shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
    },
    taskDone: { opacity: 0.6 },
    checkbox: { marginRight: 12 },
    checkCircle: {
      width: 24, height: 24, borderRadius: 12, borderWidth: 2,
      borderColor: colors.border, alignItems: "center", justifyContent: "center",
    },
    checkDone: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    taskInfo: { flex: 1 },
    taskTitle: { fontFamily: "Inter_500Medium", fontSize: 15, color: colors.foreground },
    taskTitleDone: { textDecorationLine: "line-through", color: colors.mutedForeground },
    taskMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    priorityDot: { width: 8, height: 8, borderRadius: 4 },
    taskStatus: { fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground },
    deleteBtn: { padding: 6 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
    sheet: {
      backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24,
    },
    sheetTitle: { fontFamily: "Nunito_700Bold", fontSize: 22, color: colors.foreground, marginBottom: 16 },
    sheetInput: {
      backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      fontFamily: "Inter_400Regular", fontSize: 15, color: colors.foreground,
    },
    sheetLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: colors.mutedForeground, marginTop: 16, marginBottom: 8 },
    priorityRow: { flexDirection: "row", gap: 10 },
    priorityBtn: {
      flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center",
      backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border,
    },
    priorityBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: colors.foreground },
    submitBtn: {
      backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14,
      alignItems: "center", marginTop: 24,
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
  });
}
