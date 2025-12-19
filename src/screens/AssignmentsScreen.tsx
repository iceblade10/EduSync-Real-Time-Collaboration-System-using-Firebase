
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";

type TabKey = "due" | "upcoming" | "completed";

type GlobalAssignment = {
  key: string; 
  id: string;
  groupId: string;
  groupName?: string;

  title: string;
  description?: string;
  dueDate: Timestamp;

  status?: "upcoming" | "due" | "completed";
  createdAt?: any;
};

function formatDate(ts?: Timestamp) {
  if (!ts) return "-";
  const d = ts.toDate();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
}

function endOfDayPlus(days: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 59);
}

function computeBucket(a: GlobalAssignment): TabKey {
  
  if (a.status === "completed") return "completed";

  
  const due = a.dueDate?.toDate?.() ?? new Date(0);
  const today = startOfToday();
  const dueSoonLimit = endOfDayPlus(7);

  if (due <= dueSoonLimit) {
 
    return "due";
  }

  return "upcoming";
}

export default function AssignmentsScreen() {
  const user = auth.currentUser;

  const [tab, setTab] = useState<TabKey>("due");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [itemsMap, setItemsMap] = useState<Record<string, GlobalAssignment>>({});
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    
    const groupsRef = collection(db, "groups");
    const q = query(groupsRef, where("memberIds", "array-contains", user.uid));

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const gids: string[] = [];
        const names: Record<string, string> = {};

        snap.forEach((d) => {
          gids.push(d.id);
          const data = d.data() as any;
         
          names[d.id] = data?.groupName || data?.name || "Group";
        });

        setGroupIds(gids);
        setGroupNames((prev) => ({ ...prev, ...names }));
        setLoading(false);
      },
      async (err) => {
    
        Alert.alert("Error", err?.message ?? "Failed to load groups");
        setGroupIds([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);


  useEffect(() => {
    if (!user) return;

  
    setItemsMap({});

    if (groupIds.length === 0) return;

    const unsubs: Array<() => void> = [];

    groupIds.forEach((gid) => {
      const ref = collection(db, "groups", gid, "assignments");
      const q = query(ref, orderBy("dueDate", "asc"));

      const unsub = onSnapshot(
        q,
        (snap) => {
          setItemsMap((prev) => {
            const next = { ...prev };

          
            Object.keys(next).forEach((k) => {
              if (k.startsWith(gid + "_")) delete next[k];
            });

         
            snap.forEach((d) => {
              const data = d.data() as any;
              const key = `${gid}_${d.id}`;

              next[key] = {
                key,
                id: d.id,
                groupId: gid,
                groupName: groupNames[gid],
                title: data.title ?? "Untitled",
                description: data.description ?? "",
                dueDate: data.dueDate,
                status: data.status,
                createdAt: data.createdAt,
              };
            });

            return next;
          });
        },
        (err) => {
          console.log("assignments listener error:", err);
        }
      );

      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u());
  }, [groupIds.join("|"), user?.uid, groupNames]);

  const allItems = useMemo(() => Object.values(itemsMap), [itemsMap]);

  const { dueSoon, upcoming, completed } = useMemo(() => {
    const due: GlobalAssignment[] = [];
    const up: GlobalAssignment[] = [];
    const done: GlobalAssignment[] = [];

    allItems.forEach((a) => {
      const bucket = computeBucket(a);
      if (bucket === "due") due.push(a);
      else if (bucket === "upcoming") up.push(a);
      else done.push(a);
    });

    due.sort((a, b) => a.dueDate.toMillis() - b.dueDate.toMillis());
    up.sort((a, b) => a.dueDate.toMillis() - b.dueDate.toMillis());
    done.sort((a, b) => b.dueDate.toMillis() - a.dueDate.toMillis());

    return { dueSoon: due, upcoming: up, completed: done };
  }, [allItems]);

  const visible = tab === "due" ? dueSoon : tab === "upcoming" ? upcoming : completed;

  const markCompleted = async (a: GlobalAssignment) => {
    try {
      await updateDoc(doc(db, "groups", a.groupId, "assignments", a.id), {
        status: "completed",
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to mark completed");
    }
  };

  const renderItem = ({ item }: { item: GlobalAssignment }) => {
    const dueStr = formatDate(item.dueDate);

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.title}>{item.title}</Text>
          {!!item.groupName && <Text style={styles.groupTag}>{item.groupName}</Text>}
        </View>

        {!!item.description && <Text style={styles.desc}>{item.description}</Text>}

        <Text style={styles.meta}>Submission date: {dueStr}</Text>

        {tab !== "completed" && (
          <TouchableOpacity style={styles.completeBtn} onPress={() => markCompleted(item)}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.completeText}>Mark Completed</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.header}>Assignment Deadlines</Text>
      </View>

      {/* Tabs (chips) */}
      <View style={styles.chipsRow}>
        <Chip active={tab === "due"} label="Due Soon" onPress={() => setTab("due")} />
        <Chip active={tab === "upcoming"} label="Upcoming" onPress={() => setTab("upcoming")} />
        <Chip active={tab === "completed"} label="Completed" onPress={() => setTab("completed")} />
      </View>

      {/* List */}
      <FlatList
        data={visible}
        keyExtractor={(i) => i.key}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 30 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading
              ? "Loading..."
              : tab === "completed"
              ? "No completed assignments yet."
              : tab === "upcoming"
              ? "No upcoming assignments."
              : "No due soon assignments."}
          </Text>
        }
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      <Text style={[styles.chipText, !active && { opacity: 0.9 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 16 },

  headerRow: { marginBottom: 10 },
  header: { color: "#fff", fontSize: 22, fontWeight: "900" },

  chipsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },

  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: "#b00020" },
  chipInactive: { backgroundColor: "#2a2a2a" },
  chipText: { color: "#fff", fontWeight: "900" },

  card: {
    backgroundColor: "#222",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { color: "#fff", fontSize: 16, fontWeight: "900", flex: 1 },
  groupTag: { color: "#bbb", fontWeight: "800", fontSize: 12 },

  desc: { color: "#bbb", marginTop: 6 },
  meta: { color: "#aaa", marginTop: 8, fontWeight: "700" },

  completeBtn: {
    marginTop: 12,
    backgroundColor: "#b00020",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  completeText: { color: "#fff", fontWeight: "900" },

  empty: { color: "#aaa", marginTop: 16 },
});
