
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import {
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { Ionicons } from "@expo/vector-icons";

type Task = {
  id: string;
  title: string;
  completed: boolean;
  parentId: string | null;
};

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");

  const user = auth.currentUser;


  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "tasks"), where("uid", "==", user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Task[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        list.push({
          id: docSnap.id,
          title: data.title,
          completed: data.completed,
          parentId: data.parentId,
        });
      });
      setTasks(list);
    });

    return () => unsubscribe();
  }, []);

 
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  async function addTask() {
    if (!newTask.trim() || !user) return;

    await addDoc(collection(db, "tasks"), {
      uid: user.uid,
      title: newTask.trim(),
      completed: false,
      parentId: null,
      createdAt: serverTimestamp(),
    });

    setNewTask("");
  }

  async function toggleTask(task: Task) {
    await updateDoc(doc(db, "tasks", task.id), {
      completed: !task.completed,
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Tasks</Text>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          Progress: {completedCount}/{totalCount}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(completedCount / totalCount) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Add new task */}
      <View style={styles.addContainer}>
        <TextInput
          placeholder="Add your task title"
          placeholderTextColor="#777"
          value={newTask}
          onChangeText={setNewTask}
          style={styles.input}
        />
        <TouchableOpacity style={styles.addButton} onPress={addTask}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Task List */}
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.taskItem}
            onPress={() => toggleTask(item)}
          >
            <Ionicons
              name={item.completed ? "checkbox" : "square-outline"}
              size={26}
              color="#ffcc00"
            />
            <Text
              style={[
                styles.taskText,
                item.completed && { textDecorationLine: "line-through" },
              ]}
            >
              {item.title}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 16 },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  progressContainer: { marginBottom: 20 },
  progressText: { color: "#fff", marginBottom: 6 },
  progressBar: {
    width: "100%",
    height: 10,
    backgroundColor: "#333",
    borderRadius: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#ffcc00",
  },
  addContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: "#222",
    padding: 12,
    borderRadius: 10,
    color: "#fff",
    fontSize: 16,
  },
  addButton: {
    marginLeft: 12,
    backgroundColor: "#ff4444",
    height: 50,
    width: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#222",
    borderRadius: 10,
    marginBottom: 10,
  },
  taskText: { color: "#fff", marginLeft: 12, fontSize: 16 },
});
