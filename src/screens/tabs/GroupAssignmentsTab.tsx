
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../firebase/config";

type AssignmentDoc = {
  id: string;
  title: string;
  description?: string;
  dueDate: Timestamp;
  status: "upcoming" | "due" | "completed";
  createdAt?: any;
  createdBy?: string;

 
  
  groupId?: string;
  groupName?: string;
  memberIds?: string[];
};

type GroupDoc = {
  name?: string;
  memberIds?: string[];
  members?: { uid: string; name?: string; role?: string }[];
};

function safeGetGroupId(route: any) {
  return (
    route?.params?.groupId ||
    route?.params?.params?.groupId ||
    route?.params?.target?.params?.groupId ||
    route?.params?.target?.groupId ||
    null
  );
}

function formatDate(ts: Timestamp | undefined) {
  if (!ts) return "-";
  const d = ts.toDate();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function computeStatus(due: Date) {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return due <= endOfToday ? "due" : "upcoming";
}

async function notifyGroupMembersOnAssignmentAdd(params: {
  groupId: string;
  groupName: string;
  memberIds: string[];
  title: string;
  dueDate: Date;
  createdBy: string;
}) {
  const { groupId, groupName, memberIds, title, dueDate, createdBy } = params;

  const batch = writeBatch(db);

  const dd = String(dueDate.getDate()).padStart(2, "0");
  const mm = String(dueDate.getMonth() + 1).padStart(2, "0");
  const yyyy = dueDate.getFullYear();


  memberIds.forEach((uid) => {
    const nref = doc(collection(db, "users", uid, "notifications"));
    batch.set(nref, {
      title: "New assignment added",
      message: `${title} (Due: ${dd}/${mm}/${yyyy}) in ${groupName}`,
      createdAt: serverTimestamp(),
      read: false,
      type: "assignment",
      groupId,
      groupName,
      dueDate: Timestamp.fromDate(dueDate),
      createdBy,
      target: {
        screen: "AssignmentsTab",
        params: {},
      },
    });
  });

  await batch.commit();
}

export default function GroupAssignmentsTab({ route }: any) {
  const user = auth.currentUser;
  const groupId = useMemo(() => safeGetGroupId(route), [route]);

  const [items, setItems] = useState<AssignmentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  
  const [groupName, setGroupName] = useState<string>("");
  const [memberIds, setMemberIds] = useState<string[]>([]);


  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  
  useEffect(() => {
    if (!groupId) return;

    const run = async () => {
      try {
        const gSnap = await getDoc(doc(db, "groups", groupId));
        if (!gSnap.exists()) return;

        const g = gSnap.data() as GroupDoc;

        const name = g.name ?? "Group";
        setGroupName(name);

        
        let ids = (g.memberIds ?? []).filter(Boolean);

        
        if (ids.length === 0 && Array.isArray(g.members)) {
          ids = g.members.map((m) => m.uid).filter(Boolean);
        }

        setMemberIds(ids);
      } catch (e) {
        
      }
    };

    run();
  }, [groupId]);

  
  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    const ref = collection(db, "groups", groupId, "assignments");
    const q = query(ref, orderBy("dueDate", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AssignmentDoc[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        setItems(list);
        setLoading(false);
      },
      (err) => {
        Alert.alert("Error", err?.message ?? "Failed to load assignments");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [groupId]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueDate(new Date());
    setShowPicker(false);
  };

  const openAdd = () => {
    resetForm();
    setOpen(true);
  };

  const closeAdd = () => {
    setOpen(false);
    setShowPicker(false);
  };

  const onPickDate = (_: any, selected?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (selected) setDueDate(selected);
  };

  const addAssignment = async () => {
    if (!user) {
      Alert.alert("Not logged in", "Please log in again.");
      return;
    }
    if (!groupId) {
      Alert.alert("Missing group", "groupId not found in route params.");
      return;
    }

    const t = title.trim();
    if (!t) {
      Alert.alert("Validation", "Title is required.");
      return;
    }

    try {
      setSaving(true);

     
      let gName = groupName;
      let ids = memberIds;

      if (!gName || ids.length === 0) {
        const gSnap = await getDoc(doc(db, "groups", groupId));
        if (gSnap.exists()) {
          const g = gSnap.data() as GroupDoc;
          gName = g.name ?? "Group";

          ids = (g.memberIds ?? []).filter(Boolean);
          if (ids.length === 0 && Array.isArray(g.members)) {
            ids = g.members.map((m) => m.uid).filter(Boolean);
          }
        }
      }

      const status = computeStatus(dueDate);

      
      const ref = collection(db, "groups", groupId, "assignments");
      await addDoc(ref, {
        title: t,
        description: description.trim(),
        dueDate: Timestamp.fromDate(dueDate),
        status,
        createdAt: serverTimestamp(),
        createdBy: user.uid,

        
        groupId,
        groupName: gName || "Group",
        memberIds: ids.length ? ids : [user.uid],
      });

      
      await notifyGroupMembersOnAssignmentAdd({
        groupId,
        groupName: gName || "Group",
        memberIds: ids.length ? ids : [user.uid],
        title: t,
        dueDate,
        createdBy: user.uid,
      });

      Alert.alert("Added", "Assignment created + members notified.");
      closeAdd();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add assignment");
    } finally {
      setSaving(false);
    }
  };

  const markCompleted = async (a: AssignmentDoc) => {
    if (!groupId) return;
    try {
      await updateDoc(doc(db, "groups", groupId, "assignments", a.id), {
        status: "completed",
        completedAt: serverTimestamp(),
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to mark completed");
    }
  };

  const renderItem = ({ item }: { item: AssignmentDoc }) => {
    const isCompleted = item.status === "completed";
    const statusLabel =
      item.status === "completed" ? "Completed" : item.status === "due" ? "Due" : "Upcoming";

    return (
      <View style={[styles.card, isCompleted && styles.cardDone]}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View
            style={[
              styles.pill,
              isCompleted ? styles.pillDone : item.status === "due" ? styles.pillDue : styles.pillUpcoming,
            ]}
          >
            <Text style={styles.pillText}>{statusLabel}</Text>
          </View>
        </View>

        {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}

        <Text style={styles.cardMeta}>Due date: {formatDate(item.dueDate)}</Text>

        {!isCompleted && (
          <TouchableOpacity style={styles.completeBtn} onPress={() => markCompleted(item)}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.completeText}>Mark Completed</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!groupId) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Assignments</Text>
        <Text style={styles.empty}>groupId missing. Open this tab from Group Detail screen.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>Assignments</Text>
          {!!groupName && <Text style={{ color: "#aaa", marginTop: 2 }}>{groupName}</Text>}
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={20} color="#000" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : (
            <Text style={styles.empty}>No assignments yet. Tap “Add”.</Text>
          )
        }
      />

      <Modal visible={open} animationType="slide" transparent onRequestClose={closeAdd}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTop}>
              <Text style={styles.modalTitle}>Add Assignment</Text>
              <TouchableOpacity onPress={closeAdd}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., AI Assignment 2"
              placeholderTextColor="#777"
              style={styles.input}
            />

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g., Neural network report submission"
              placeholderTextColor="#777"
              style={[styles.input, { height: 90 }]}
              multiline
            />

            <Text style={styles.label}>Due Date</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
              <Ionicons name="calendar-outline" size={18} color="#fff" />
              <Text style={styles.dateBtnText}>{formatDate(Timestamp.fromDate(dueDate))}</Text>
            </TouchableOpacity>

            {showPicker && (
              <DateTimePicker
                value={dueDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={onPickDate}
              />
            )}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={addAssignment}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Assignment"}</Text>
            </TouchableOpacity>

            <Text style={styles.hint}>This assignment is visible to all group members.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 16 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  header: { color: "#fff", fontSize: 20, fontWeight: "900" },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  addBtnText: { color: "#000", fontWeight: "900" },

  empty: { color: "#aaa", marginTop: 16 },

  card: {
    backgroundColor: "#222",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  cardDone: { opacity: 0.75 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "900", flex: 1 },
  cardDesc: { color: "#bbb", marginTop: 6 },
  cardMeta: { color: "#aaa", marginTop: 10, fontWeight: "700" },

  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  pillDue: { backgroundColor: "#b00020" },
  pillUpcoming: { backgroundColor: "#333" },
  pillDone: { backgroundColor: "#1f7a3a" },
  pillText: { color: "#fff", fontWeight: "900", fontSize: 12 },

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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 16,
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  modalTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },

  label: { color: "#aaa", marginTop: 12, marginBottom: 6, fontWeight: "800" },
  input: {
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
  },

  dateBtn: {
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateBtnText: { color: "#fff", fontWeight: "900" },

  saveBtn: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
  },
  saveBtnText: { color: "#000", fontWeight: "900", textAlign: "center" },

  hint: { color: "#888", marginTop: 10, fontSize: 12 },
});
