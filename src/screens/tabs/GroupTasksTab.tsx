import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet, Alert } from "react-native";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/config";

type TaskStatus = "todo" | "in_progress" | "done";

type TaskItem = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  createdByName?: string;
  createdByUid?: string;
  createdAt?: any;
};

const nextStatus = (s: TaskStatus): TaskStatus => {
  if (s === "todo") return "in_progress";
  if (s === "in_progress") return "done";
  return "todo";
};

export default function GroupTasksTab({ route }: any) {
  const { groupId } = route.params;
  const user = auth.currentUser;

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    const tasksRef = collection(db, "groups", groupId, "tasks");
    const q = query(tasksRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const list: TaskItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          title: data.title ?? "",
          description: data.description ?? "",
          status: (data.status ?? "todo") as TaskStatus,
          createdByName: data.createdByName ?? "",
          createdByUid: data.createdByUid ?? "",
          createdAt: data.createdAt,
        });
      });
      setTasks(list);
    });

    return () => unsub();
  }, [groupId]);

  const addTask = async () => {
    if (!user) return Alert.alert("Error", "You must be logged in.");
    if (!title.trim()) return Alert.alert("Error", "Task title is required.");

    try {
      await addDoc(collection(db, "groups", groupId, "tasks"), {
        title: title.trim(),
        description: desc.trim(),
        status: "todo",
        createdByUid: user.uid,
        createdByName: user.displayName || user.email || user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTitle("");
      setDesc("");
    } catch (e: any) {
      console.log("ADD TASK ERROR", e);
      Alert.alert("Add failed", e?.message ?? "Unknown error");
    }
  };

  const cycleStatus = async (task: TaskItem) => {
    try {
      const ref = doc(db, "groups", groupId, "tasks", task.id);
      await updateDoc(ref, {
        status: nextStatus(task.status),
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      console.log("UPDATE TASK ERROR", e);
      Alert.alert("Update failed", e?.message ?? "Unknown error");
    }
  };

  const removeTask = async (task: TaskItem) => {
    Alert.alert("Delete task?", task.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "groups", groupId, "tasks", task.id));
          } catch (e: any) {
            console.log("DELETE TASK ERROR", e);
            Alert.alert("Delete failed", e?.message ?? "Unknown error");
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: TaskItem }) => (
    <TouchableOpacity style={styles.card} onPress={() => cycleStatus(item)} onLongPress={() => removeTask(item)}>
      <Text style={styles.title}>{item.title}</Text>
      {!!item.description && <Text style={styles.meta}>{item.description}</Text>}
      <Text style={styles.meta}>Status: {item.status}</Text>
      {!!item.createdByName && <Text style={styles.meta}>By: {item.createdByName}</Text>}
      <Text style={styles.hint}>Tap = change status • Long press = delete</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Tasks (Real-time)</Text>

      <View style={styles.form}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Task title"
          placeholderTextColor="#777"
          style={styles.input}
        />
        <TextInput
          value={desc}
          onChangeText={setDesc}
          placeholder="Description (optional)"
          placeholderTextColor="#777"
          style={styles.input}
        />
        <TouchableOpacity style={styles.btn} onPress={addTask}>
          <Text style={styles.btnText}>Add Task</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No tasks yet. Add the first one.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 16 },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 10 },
  form: { backgroundColor: "#1a1a1a", padding: 12, borderRadius: 12, marginBottom: 12 },
  input: { backgroundColor: "#222", color: "#fff", borderRadius: 10, padding: 12, marginBottom: 10 },
  btn: { backgroundColor: "#ff4444", padding: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800" },
  card: { backgroundColor: "#222", padding: 12, borderRadius: 12, marginBottom: 10 },
  title: { color: "#fff", fontSize: 15, fontWeight: "800" },
  meta: { color: "#bbb", marginTop: 4 },
  hint: { color: "#888", marginTop: 8, fontSize: 12 },
  empty: { color: "#888", marginTop: 10 },
});
