
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";

type AppNotification = {
  id: string;
  uid: string; 
  title: string;
  message: string;
  createdAt?: any;
  read?: boolean;
  
  target?: { screen: string; params?: any };
};

export default function NotificationsScreen({ navigation }: any) {
  const user = auth.currentUser;
  if (!user) return null;
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
    collection(db, "users", user.uid, "notifications"),
    orderBy("createdAt", "desc")
  );

    const unsub = onSnapshot(q, (snap) => {
      const list: AppNotification[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setItems(list);
    });

    return () => unsub();
  }, [user?.uid]);

  const markAsRead = async (n: AppNotification) => {
    try {
      await updateDoc(doc(db, "users", user.uid, "notifications", n.id), { read: true });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to mark as read");
    }
  };

  const TAB_SCREENS = new Set([
  "HomeTab",
  "TasksTab",
  "GroupsTab",
  "AssignmentsTab",
  "ProfileTab",
]);

 const viewNotification = async (n: AppNotification) => {

  if (!n.read) await markAsRead(n);

 
  if (n.target?.screen) {
    const screen = n.target.screen;

    
    if (TAB_SCREENS.has(screen)) {
      navigation.navigate("Main", {
        screen,                 
        params: n.target.params ?? {},
      });
      return;
    }

  
    navigation.navigate(screen, n.target.params ?? {});
    return;
  }

  Alert.alert(n.title ?? "Notification", n.message ?? "");
};

  const clearAll = async () => {
    if (!user) return;

    Alert.alert(
      "Clear all?",
      "This will remove all notifications from your list.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              const batch = writeBatch(db);
              items.forEach((n) => {
                batch.delete(doc(db, "users", user.uid, "notifications", n.id));
              });
              await batch.commit();
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Failed to clear notifications");
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const isUnread = !item.read;

    return (
      <TouchableOpacity
        style={[styles.card, isUnread ? styles.unreadCard : null]}
        onPress={() => viewNotification(item)}
      >
        <View style={styles.row}>
          <Text style={styles.title}>{item.title}</Text>
          {!item.read ? <Text style={styles.badge}>NEW</Text> : null}
        </View>

        <Text style={styles.msg}>{item.message}</Text>

        <View style={styles.actions}>
          {!item.read ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => markAsRead(item)}
            >
              <Text style={styles.actionText}>Mark as Read</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Your notifications</Text>

        {items.length > 0 ? (
          <TouchableOpacity onPress={clearAll}>
            <Text style={styles.clearAll}>Clear All</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>No notifications yet.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  header: { color: "#fff", fontSize: 18, fontWeight: "800" },
  clearAll: { color: "#ff4444", fontWeight: "800" },

  card: {
    backgroundColor: "#222",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  unreadCard: { borderWidth: 1, borderColor: "#ff4444" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { color: "#fff", fontSize: 15, fontWeight: "800", flex: 1 },
  badge: { color: "#ff4444", fontWeight: "900" },
  msg: { color: "#aaa", marginTop: 6 },

  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#444",
  },
  actionText: { color: "#fff", fontWeight: "700" },

  empty: { color: "#888", marginTop: 10 },
});
