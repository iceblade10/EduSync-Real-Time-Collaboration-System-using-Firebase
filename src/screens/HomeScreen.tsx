
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { HomeStackParamList } from "../navigation/HomeStack";
import { MainTabParamList } from "../navigation/MainTabs";
import { Calendar } from "react-native-calendars";
import { collectionGroup } from "firebase/firestore";

type HomeNavProp = NativeStackNavigationProp<HomeStackParamList, "HomeMain">;
type TabNavProp = BottomTabNavigationProp<MainTabParamList>;

type Assignment = {
  id: string;
  title: string;
  dueDate: any; 
  status: "due" | "upcoming" | "completed";
};

type Reminder = {
  id: string;
  title: string;
  date: string; 
  createdAt?: any;
};

function toDateStringFromTimestamp(ts: any): string | null {
  try {
    if (!ts) return null;
    const ms = ts?.toMillis?.();
    if (!ms) return null;
    const d = new Date(ms);
    
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return null;
  }
}

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function HomeScreen() {
  const navigation = useNavigation<any>(); 
  const homeNav = useNavigation<HomeNavProp>();
  const tabNav = useNavigation<TabNavProp>();

  const user = auth.currentUser;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);


  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(todayString());

 
  const [reminders, setReminders] = useState<Reminder[]>([]);

  
  const [adding, setAdding] = useState(false);
  const [remTitle, setRemTitle] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);


  useEffect(() => {
  if (!user) return;

  
  const q = query(
    collectionGroup(db, "assignments"),
    where("memberIds", "array-contains", user.uid)
  );

  const unsub = onSnapshot(q, (snap) => {
    const list: Assignment[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      list.push({
        id: d.id,
        title: data.title,
        dueDate: data.dueDate,
        status: data.status,
      });
    });

    
    list.sort((a: any, b: any) => a.dueDate?.toMillis?.() - b.dueDate?.toMillis?.());
    setAssignments(list);
  });

  return () => unsub();
}, [user?.uid]);


 
  useEffect(() => {
    if (!user) return;

    const notifRef = collection(db, "users", user.uid, "notifications");
    const qy = query(notifRef, where("read", "==", false));

    const unsub = onSnapshot(qy, (snap) => {
      setUnreadCount(snap.size);
    });

    return () => unsub();
  }, [user?.uid]);


  useEffect(() => {
    if (!user) return;

    const remRef = collection(db, "users", user.uid, "reminders");
    const qy = query(remRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(qy, (snap) => {
      const list: Reminder[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (typeof data?.date === "string") {
          list.push({
            id: d.id,
            title: data.title ?? "Reminder",
            date: data.date,
            createdAt: data.createdAt,
          });
        }
      });
      setReminders(list);
    });

    return () => unsub();
  }, [user?.uid]);

  const stats = useMemo(() => {
    const total = assignments.length;
    const completed = assignments.filter((a) => a.status === "completed").length;

    const upcoming = assignments
      .filter((a) => a.status === "upcoming")
      .sort(
        (a: any, b: any) => a.dueDate?.toMillis?.() - b.dueDate?.toMillis?.()
      )
      .slice(0, 3);

    const dueSoon = assignments
      .filter((a) => a.status === "due")
      .sort(
        (a: any, b: any) => a.dueDate?.toMillis?.() - b.dueDate?.toMillis?.()
      )
      .slice(0, 3);

    return { total, completed, upcoming, dueSoon };
  }, [assignments]);

  const openNotifications = () => {
    navigation.navigate("Notifications");
  };

  const openCalendar = () => {
    setSelectedDate((prev) => prev || todayString());
    setCalendarOpen(true);
  };


  const markedDates = useMemo(() => {
    
    const map: Record<string, { dots?: any[]; selected?: boolean; selectedColor?: string }> = {};

 
    for (const a of assignments) {
      const ds = toDateStringFromTimestamp(a.dueDate);
      if (!ds) continue;

      if (!map[ds]) map[ds] = {};
      const dots = map[ds].dots ?? [];
      
      if (!dots.some((d) => d.key === "assignment")) {
        dots.push({ key: "assignment", color: "#ffcc00" });
      }
      map[ds].dots = dots;
    }

    
    for (const r of reminders) {
      const ds = r.date;
      if (!ds) continue;

      if (!map[ds]) map[ds] = {};
      const dots = map[ds].dots ?? [];
      if (!dots.some((d) => d.key === "reminder")) {
        dots.push({ key: "reminder", color: "#ff6c6c" });
      }
      map[ds].dots = dots;
    }

   
    if (selectedDate) {
      if (!map[selectedDate]) map[selectedDate] = {};
      map[selectedDate].selected = true;
      map[selectedDate].selectedColor = "#b00020";
    }

    return map;
  }, [assignments, reminders, selectedDate]);

  
  const dayAssignments = useMemo(() => {
    return assignments
      .map((a) => ({ ...a, dateString: toDateStringFromTimestamp(a.dueDate) }))
      .filter((a: any) => a.dateString === selectedDate)
      .sort((a: any, b: any) => {
        const am = a?.dueDate?.toMillis?.() ?? 0;
        const bm = b?.dueDate?.toMillis?.() ?? 0;
        return am - bm;
      });
  }, [assignments, selectedDate]);

  const dayReminders = useMemo(() => {
    return reminders.filter((r) => r.date === selectedDate);
  }, [reminders, selectedDate]);

 
  const startAddReminder = () => {
    setRemTitle("");
    setAdding(true);
  };

  const saveReminder = async () => {
    if (!user) return;

    const title = remTitle.trim();
    if (!title) {
      Alert.alert("Validation", "Reminder title cannot be empty.");
      return;
    }

    try {
      setSavingReminder(true);
      await addDoc(collection(db, "users", user.uid, "reminders"), {
        title,
        date: selectedDate, 
        createdAt: serverTimestamp(),
      });
      setAdding(false);
      Alert.alert("Saved", "Reminder added to your calendar.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add reminder");
    } finally {
      setSavingReminder(false);
    }
  };

  return (
    <>
      <ScrollView style={styles.container}>
        {/* Top row: Hello + Bell */}
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hello!</Text>
            <Text style={styles.sub}>
              Welcome back, {user?.displayName || "Student"}.
            </Text>
          </View>

          <TouchableOpacity style={styles.bellBtn} onPress={openNotifications}>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick nav */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => tabNav.navigate("TasksTab")}
          >
            <Text style={styles.quickText}>Tasks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => tabNav.navigate("AssignmentsTab")}
          >
            <Text style={styles.quickText}>Deadlines</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => tabNav.navigate("GroupsTab")}
          >
            <Text style={styles.quickText}>Groups</Text>
          </TouchableOpacity>
        </View>

        {/* Cards */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Assignment Progress</Text>
          <Text style={styles.cardValue}>
            {stats.completed}/{stats.total} completed
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upcoming Assignments</Text>
          {stats.upcoming.length === 0 ? (
            <Text style={styles.cardMuted}>No upcoming assignments.</Text>
          ) : (
            stats.upcoming.map((a) => (
              <Text key={a.id} style={styles.itemText}>
                • {a.title}
              </Text>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Assignment Deadlines</Text>
          {stats.dueSoon.length === 0 ? (
            <Text style={styles.cardMuted}>No due soon assignments.</Text>
          ) : (
            stats.dueSoon.map((a) => (
              <Text key={a.id} style={styles.itemText}>
                • {a.title}
              </Text>
            ))
          )}
        </View>

        {/* Calendar button */}
        <TouchableOpacity style={styles.reminderBtn} onPress={openCalendar}>
          <Text style={styles.reminderText}>View Your Calendar of Reminders</Text>
        </TouchableOpacity>

        {/* (Optional) Keep your old screen route if you still want it somewhere */}
        {/* <TouchableOpacity onPress={() => homeNav.navigate("Reminders")}>
          <Text style={{ color: "#aaa", textAlign: "center" }}>Open Reminders Screen</Text>
        </TouchableOpacity> */}
      </ScrollView>

      {/* Calendar Modal */}
      <Modal
        visible={calendarOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <Pressable
          style={stylesCal.backdrop}
          onPress={() => {
            setAdding(false);
            setCalendarOpen(false);
          }}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={stylesCal.kbWrap}
        >
          <View style={stylesCal.sheet}>
            <View style={stylesCal.sheetHeader}>
              <View>
                <Text style={stylesCal.sheetTitle}>Calendar</Text>
                <Text style={stylesCal.sheetSub}>
                  Dots: <Text style={{ color: "#ffcc00" }}>Assignments</Text> •{" "}
                  <Text style={{ color: "#ff6c6c" }}>Reminders</Text>
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setAdding(false);
                  setCalendarOpen(false);
                }}
              >
                <Text style={stylesCal.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <Calendar
              markingType="multi-dot"
              onDayPress={(day) => {
                setSelectedDate(day.dateString);
              }}
              markedDates={markedDates}
              theme={{
                backgroundColor: "#111",
                calendarBackground: "#111",
                dayTextColor: "#fff",
                monthTextColor: "#fff",
                textSectionTitleColor: "#aaa",
                todayTextColor: "#ff6c6c",
                selectedDayTextColor: "#fff",
                arrowColor: "#fff",
              }}
            />

            {/* Selected day panel */}
            <View style={stylesCal.dayPanel}>
              <View style={stylesCal.dayHeaderRow}>
                <Text style={stylesCal.dayHeaderTitle}>
                  {selectedDate}
                </Text>

                <TouchableOpacity style={stylesCal.addBtn} onPress={startAddReminder}>
                  <Ionicons name="add" size={18} color="#000" />
                  <Text style={stylesCal.addBtnText}>Add Reminder</Text>
                </TouchableOpacity>
              </View>

              {/* Add reminder inline card */}
              {adding && (
                <View style={stylesCal.addCard}>
                  <Text style={stylesCal.addLabel}>Reminder title</Text>
                  <TextInput
                    value={remTitle}
                    onChangeText={setRemTitle}
                    placeholder="e.g., Submit CP1 report draft"
                    placeholderTextColor="#888"
                    style={stylesCal.addInput}
                  />

                  <View style={stylesCal.addActions}>
                    <TouchableOpacity
                      style={stylesCal.addCancel}
                      onPress={() => setAdding(false)}
                      disabled={savingReminder}
                    >
                      <Text style={stylesCal.addCancelText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={stylesCal.addSave}
                      onPress={saveReminder}
                      disabled={savingReminder}
                    >
                      <Text style={stylesCal.addSaveText}>
                        {savingReminder ? "Saving..." : "Save"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Lists */}
              <View style={stylesCal.listBlock}>
                <Text style={stylesCal.listTitle}>Assignments due</Text>
                {dayAssignments.length === 0 ? (
                  <Text style={stylesCal.listEmpty}>No assignments for this date.</Text>
                ) : (
                  dayAssignments.map((a: any) => (
                    <View key={a.id} style={stylesCal.listItem}>
                      <View style={[stylesCal.dot, { backgroundColor: "#ffcc00" }]} />
                      <Text style={stylesCal.listItemText}>{a.title}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={stylesCal.listBlock}>
                <Text style={stylesCal.listTitle}>Reminders</Text>
                {dayReminders.length === 0 ? (
                  <Text style={stylesCal.listEmpty}>No reminders for this date.</Text>
                ) : (
                  dayReminders.map((r) => (
                    <View key={r.id} style={stylesCal.listItem}>
                      <View style={[stylesCal.dot, { backgroundColor: "#ff6c6c" }]} />
                      <Text style={stylesCal.listItemText}>{r.title}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 16 },

  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  hello: { color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  sub: { color: "#aaa" },

  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#b00020",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },

  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  quickBtn: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: "#222",
    padding: 14,
    borderRadius: 12,
  },
  quickText: { color: "#fff", textAlign: "center", fontWeight: "600" },

  card: {
    backgroundColor: "#222",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
  },
  cardValue: { color: "#ffcc00", fontSize: 18, fontWeight: "bold" },
  cardMuted: { color: "#aaa" },
  itemText: { color: "#ddd", marginTop: 2 },

  reminderBtn: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 30,
  },
  reminderText: {
    color: "#000",
    fontWeight: "bold",
    textAlign: "center",
  },
});

const stylesCal = StyleSheet.create({
  kbWrap: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },

  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#111",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#222",
  },

  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  sheetSub: { color: "#aaa", marginTop: 2, fontWeight: "700" },
  closeText: { color: "#ff6c6c", fontWeight: "900" },

  dayPanel: {
    marginTop: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  dayHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dayHeaderTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  addBtnText: { color: "#000", fontWeight: "900" },

  addCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 12,
  },
  addLabel: { color: "#aaa", fontWeight: "800", marginBottom: 8 },
  addInput: {
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
  },
  addActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  addCancel: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#444",
  },
  addCancelText: { color: "#fff", fontWeight: "900" },
  addSave: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#b00020",
  },
  addSaveText: { color: "#fff", fontWeight: "900" },

  listBlock: { marginTop: 10 },
  listTitle: { color: "#fff", fontWeight: "900", marginBottom: 6 },
  listEmpty: { color: "#aaa", fontWeight: "700" },

  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  listItemText: { color: "#ddd", fontWeight: "800", flex: 1 },
});
