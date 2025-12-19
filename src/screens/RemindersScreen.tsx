
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";

type CalendarEvent = {
  id: string;
  uid: string;
  type: "assignment" | "task" | "reminder" | string;
  title: string;
  description?: string;
  date: Timestamp;

  groupId?: string;
  groupName?: string;
  assignmentId?: string;

  status?: "upcoming" | "due" | "completed" | string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function monthLabel(d: Date) {
  const m = d.toLocaleString(undefined, { month: "long" });
  return `${m} ${d.getFullYear()}`;
}

function formatNiceDate(d: Date) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}


function buildMonthGrid(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

 
  const startDow = first.getDay();
  const totalDays = last.getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];


  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, 1 - (startDow - i));
    cells.push({ date: d, inMonth: false });
  }

 
  for (let day = 1; day <= totalDays; day++) {
    cells.push({ date: new Date(year, month, day), inMonth: true });
  }

  
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month, totalDays + (cells.length - (startDow + totalDays) + 1));
    cells.push({ date: d, inMonth: false });
  }

  return cells;
}

export default function RemindersScreen() {
  const user = auth.currentUser;

  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

 
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1, 0, 0, 0, 0);

    const ref = collection(db, "users", user.uid, "calendarEvents");
    const q = query(
      ref,
      where("date", ">=", Timestamp.fromDate(start)),
      where("date", "<", Timestamp.fromDate(end)),
      orderBy("date", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: CalendarEvent[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        setEvents(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        Alert.alert("Error", err?.message ?? "Failed to load calendar");
      }
    );

    return () => unsub();
  }, [user?.uid, monthCursor.getMonth(), monthCursor.getFullYear()]);

  const grid = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);


  const eventCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      const d = e.date?.toDate?.();
      if (!d) continue;
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [events]);

  const selectedEvents = useMemo(() => {
    return events.filter((e) => {
      const d = e.date?.toDate?.();
      if (!d) return false;
      return sameDay(d, selectedDate);
    });
  }, [events, selectedDate]);

  const goPrevMonth = () => {
    setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  };
  const goNextMonth = () => {
    setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  };
  const jumpToday = () => {
    const now = new Date();
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  };

  const renderCell = ({ item }: { item: { date: Date; inMonth: boolean } }) => {
    const d = item.date;
    const isSelected = sameDay(d, selectedDate);
    const isToday = sameDay(d, new Date());

    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const count = eventCountByDay.get(key) ?? 0;

    return (
      <TouchableOpacity
        style={[
          styles.dayCell,
          !item.inMonth && { opacity: 0.35 },
          isSelected && styles.daySelected,
        ]}
        onPress={() => setSelectedDate(d)}
        activeOpacity={0.8}
      >
        <Text style={[styles.dayText, isToday && styles.dayTodayText]}>
          {d.getDate()}
        </Text>

        {count > 0 && (
          <View style={styles.dotWrap}>
            <View style={styles.dot} />
            {count > 1 && <Text style={styles.dotCount}>{count}</Text>}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEvent = ({ item }: { item: CalendarEvent }) => {
    const d = item.date?.toDate?.();
    const dueText = d ? formatNiceDate(d) : "-";

    const isAssignment = item.type === "assignment";
    const badge = isAssignment ? "ASSIGNMENT" : item.type?.toUpperCase?.() ?? "EVENT";

    return (
      <View style={styles.eventCard}>
        <View style={styles.eventTop}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.eventBadge}>
            <Text style={styles.eventBadgeText}>{badge}</Text>
          </View>
        </View>

        {!!item.groupName && (
          <Text style={styles.eventMeta}>Group: {item.groupName}</Text>
        )}

        {!!item.description && (
          <Text style={styles.eventDesc} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <Text style={styles.eventMeta}>Date: {dueText}</Text>
      </View>
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.muted}>You are not logged in.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Calendar</Text>

        <TouchableOpacity style={styles.todayBtn} onPress={jumpToday}>
          <Ionicons name="calendar" size={16} color="#000" />
          <Text style={styles.todayText}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* Month controls */}
      <View style={styles.monthRow}>
        <TouchableOpacity style={styles.navBtn} onPress={goPrevMonth}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.monthLabel}>{monthLabel(monthCursor)}</Text>

        <TouchableOpacity style={styles.navBtn} onPress={goNextMonth}>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Weekdays */}
      <View style={styles.weekRow}>
        {["S", "M", "T", "W", "T", "F", "S"].map((w) => (
          <Text key={w} style={styles.weekText}>
            {w}
          </Text>
        ))}
      </View>

      {/* Calendar grid */}
      <FlatList
        data={grid}
        keyExtractor={(x) => x.date.toISOString()}
        numColumns={7}
        scrollEnabled={false}
        renderItem={renderCell}
        contentContainerStyle={styles.grid}
      />

      {/* Agenda */}
      <View style={styles.agendaHeader}>
        <Text style={styles.agendaTitle}>Agenda</Text>
        <Text style={styles.agendaDate}>{formatNiceDate(selectedDate)}</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading…</Text>
        </View>
      ) : (
        <FlatList
          data={selectedEvents}
          keyExtractor={(i) => i.id}
          renderItem={renderEvent}
          ListEmptyComponent={
            <Text style={styles.empty}>No events on this day.</Text>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
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
  title: { color: "#fff", fontSize: 22, fontWeight: "900" },

  todayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  todayText: { color: "#000", fontWeight: "900" },

  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: { color: "#fff", fontWeight: "900", fontSize: 16 },

  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  weekText: { color: "#777", width: "14.285%", textAlign: "center", fontWeight: "900" },

  grid: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    marginBottom: 14,
  },

  dayCell: {
    width: "14.285%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginVertical: 2,
  },
  daySelected: {
    backgroundColor: "#b00020",
  },
  dayText: { color: "#fff", fontWeight: "900" },
  dayTodayText: { textDecorationLine: "underline" },

  dotWrap: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ffcc00" },
  dotCount: { color: "#ffcc00", fontWeight: "900", fontSize: 10 },

  agendaHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  agendaTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  agendaDate: { color: "#aaa", fontWeight: "900" },

  eventCard: {
    backgroundColor: "#222",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  eventTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  eventTitle: { color: "#fff", fontWeight: "900", fontSize: 15, flex: 1 },
  eventBadge: { backgroundColor: "#333", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  eventBadgeText: { color: "#fff", fontWeight: "900", fontSize: 11 },

  eventDesc: { color: "#bbb", marginTop: 6 },
  eventMeta: { color: "#aaa", marginTop: 8, fontWeight: "800" },

  loading: { paddingVertical: 16, alignItems: "center", gap: 8 },
  muted: { color: "#aaa" },
  empty: { color: "#aaa", marginTop: 10 },
});
