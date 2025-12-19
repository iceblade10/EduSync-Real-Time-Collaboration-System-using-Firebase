
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  Share,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

type GroupMember = {
  uid: string;
  name?: string | null;
  role?: "admin" | "member";
};

type GroupDoc = {
  name: string;
  description?: string;
  joinCode: string;
  createdBy: string;
  createdAt?: any;
  memberIds?: string[];
  members?: GroupMember[];
};

type Group = {
  id: string;
  name: string;
  description?: string;
  joinCode: string;
  createdBy: string;
  memberIds: string[];
  members: GroupMember[];
};

function generateJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function GroupScreen() {
  const navigation = useNavigation<any>();

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [joinInput, setJoinInput] = useState("");

  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);


  
  const isMember = (g: Group, uid: string) => {
    if (g.memberIds?.includes(uid)) return true;
    if (g.createdBy === uid) return true;
    if (g.members?.some((m) => m.uid === uid)) return true;
    return false;
  };

  useEffect(() => {
    const qRef = query(collection(db, "groups"));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const uid = auth.currentUser?.uid;
        const list: Group[] = [];

        snap.forEach((d) => {
          const data = d.data() as GroupDoc;

          const safeMemberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
          const safeMembers = Array.isArray(data.members) ? data.members : [];

          const g: Group = {
            id: d.id,
            name: data.name,
            description: data.description,
            joinCode: data.joinCode,
            createdBy: data.createdBy,
            memberIds: safeMemberIds,
            members: safeMembers,
          };

          if (!uid) return;
          if (isMember(g, uid)) list.push(g);
        });

        list.sort((a, b) => a.name.localeCompare(b.name));
        setGroups(list);
      },
      (error) => {
        console.error(error);
        Alert.alert("Error", "Failed to load groups in real time.");
      }
    );

    return () => unsub();
  }, []);

  async function handleCreateGroup() {
    const u = auth.currentUser;
    if (!u) return Alert.alert("Error", "You must be logged in.");

    const name = groupName.trim();
    const desc = groupDesc.trim();

    if (!name) return Alert.alert("Validation", "Please enter a group name.");

    try {
      setCreating(true);
      const joinCode = generateJoinCode();

      await addDoc(collection(db, "groups"), {
        name,
        description: desc,
        joinCode,
        createdAt: serverTimestamp(),
        createdBy: u.uid,
        memberIds: [u.uid],
        members: [
          {
            uid: u.uid,
            name: u.displayName || u.email || u.uid,
            role: "admin",
          },
        ],
      });

      setGroupName("");
      setGroupDesc("");
      Alert.alert("Created", `Group created.\nJoin code: ${joinCode}`);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err?.message ?? "Failed to create group.");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinGroup() {
    const u = auth.currentUser;
    if (!u) return Alert.alert("Error", "You must be logged in.");

    const code = joinInput.trim().toUpperCase();
    if (!code) return Alert.alert("Validation", "Please enter a join code.");

    try {
      setJoining(true);

     
      const groupsSnap = await new Promise<any>((resolve, reject) => {
        const unsub = onSnapshot(
          query(collection(db, "groups")),
          (snap) => {
            unsub();
            resolve(snap);
          },
          (e) => reject(e)
        );
      });

      const match = groupsSnap.docs.find((d: any) => (d.data() as GroupDoc).joinCode === code);

      if (!match) {
        Alert.alert("Not found", "No group found with that code.");
        return;
      }

      const groupId = match.id;
      const groupData = match.data() as GroupDoc;

      const memberIds = Array.isArray(groupData.memberIds) ? groupData.memberIds : [];
      const members = Array.isArray(groupData.members) ? groupData.members : [];

      const already =
        memberIds.includes(u.uid) ||
        groupData.createdBy === u.uid ||
        members.some((m) => m.uid === u.uid);

      if (already) {
        Alert.alert("Already joined", "You are already a member of this group.");
        return;
      }

      Alert.alert(
        "Confirm Join",
        `Join this group?\n\n${groupData.name}\n${groupData.description || ""}\n\nCode: ${groupData.joinCode}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Join",
            onPress: async () => {
              const groupRef = doc(db, "groups", groupId);

              await updateDoc(groupRef, {
                memberIds: arrayUnion(u.uid),
                members: arrayUnion({
                  uid: u.uid,
                  name: u.displayName || u.email || u.uid,
                  role: "member",
                }),
              });

              setJoinInput("");
              Alert.alert("Success", "You joined the group!");
            },
          },
        ]
      );
    } catch (err: any) {
      console.log("JOIN GROUP ERROR:", err);
      Alert.alert("Error", err?.message ?? "Failed to join group.");
    } finally {
      setJoining(false);
    }
  }

  async function handleCopyCode(code: string) {
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert("Copied", `Join code copied: ${code}`);
    } catch (e) {
      try {
        await Share.share({ message: `EduSync group join code: ${code}` });
      } catch {
        Alert.alert("Error", "Could not copy/share the code.");
      }
    }
  }

  async function handleLeaveGroup(groupId: string, groupName: string) {
    const u = auth.currentUser;
    if (!u) return Alert.alert("Error", "You must be logged in.");

    Alert.alert("Leave group", `Are you sure you want to leave "${groupName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            const groupRef = doc(db, "groups", groupId);

            await runTransaction(db, async (tx) => {
              const snap = await tx.get(groupRef);
              if (!snap.exists()) throw new Error("Group no longer exists.");

              const data = snap.data() as GroupDoc;

              const memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
              const members = Array.isArray(data.members) ? data.members : [];

              tx.update(groupRef, {
                memberIds: memberIds.filter((id) => id !== u.uid),
                members: members.filter((m) => m.uid !== u.uid),
              });
            });

            Alert.alert("Left", "You left the group.");
          } catch (err: any) {
            console.log("LEAVE GROUP ERROR:", err);
            Alert.alert("Error", err?.message ?? "Failed to leave group.");
          }
        },
      },
    ]);
  }

  const renderItem = ({ item }: { item: Group }) => {
    return (
      <TouchableOpacity
        style={styles.groupCard}
        activeOpacity={0.9}
        onPress={() =>
          navigation.navigate("GroupDetail", {
            groupId: item.id,
            groupName: item.name,
          })
        }
      >
        <View style={styles.groupTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.groupName} numberOfLines={1}>
              {item.name}
            </Text>
            {!!item.description && (
              <Text style={styles.groupDesc} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            <Text style={styles.groupCode}>Code: {item.joinCode}</Text>
          </View>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handleCopyCode(item.joinCode)}
            activeOpacity={0.8}
          >
            <Ionicons name="copy-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={() => handleLeaveGroup(item.id, item.name)}
          activeOpacity={0.85}
        >
          <Ionicons name="exit-outline" size={16} color="#ff4444" />
          <Text style={styles.leaveBtnText}>Leave</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Your Groups</Text>
            <Text style={styles.subtitle}>Create or join groups to collaborate.</Text>

            {/* Create */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Create Group</Text>

              <Text style={styles.label}>Group name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., AI Study Squad"
                placeholderTextColor="#777"
                value={groupName}
                onChangeText={setGroupName}
              />

              <Text style={styles.label}>Short description (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Share notes + track deadlines"
                placeholderTextColor="#777"
                value={groupDesc}
                onChangeText={setGroupDesc}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreateGroup}
                disabled={creating}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={18} color="#000" />
                <Text style={styles.primaryBtnText}>{creating ? "Creating..." : "Create"}</Text>
              </TouchableOpacity>
            </View>

            {/* Join */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Join Group</Text>

              <Text style={styles.label}>Join code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., LUK9QQ"
                placeholderTextColor="#777"
                value={joinInput}
                onChangeText={setJoinInput}
                autoCapitalize="characters"
              />

              <TouchableOpacity
                style={[styles.primaryBtn, joining && { opacity: 0.7 }]}
                onPress={handleJoinGroup}
                disabled={joining}
                activeOpacity={0.85}
              >
                <Ionicons name="log-in-outline" size={18} color="#000" />
                <Text style={styles.primaryBtnText}>{joining ? "Joining..." : "Join"}</Text>
              </TouchableOpacity>
            </View>

            {/* Section title for list */}
            <View style={styles.listHeaderRow}>
              <Text style={styles.listHeaderTitle}>Your Groups</Text>
              <Text style={styles.listHeaderHint}>Tap to open</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No groups yet. Create one above or join using a code.
          </Text>
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 26 }}
        showsVerticalScrollIndicator={false}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },

  title: { color: "#fff", fontSize: 22, fontWeight: "900" },
  subtitle: { color: "#aaa", marginTop: 6, marginBottom: 14 },

  card: {
    backgroundColor: "#222",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "900", marginBottom: 10 },

  label: { color: "#aaa", fontWeight: "800", marginBottom: 6, marginTop: 8 },

  input: {
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
  },

  primaryBtn: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#000", fontWeight: "900" },

  listHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 8,
  },
  listHeaderTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  listHeaderHint: { color: "#777", fontWeight: "800", fontSize: 12 },

  empty: { color: "#aaa", marginTop: 10 },

  groupCard: {
    backgroundColor: "#222",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  groupTopRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },

  groupName: { color: "#fff", fontSize: 16, fontWeight: "900" },
  groupDesc: { color: "#bbb", marginTop: 4 },
  groupCode: { color: "#999", marginTop: 8, fontWeight: "800", fontSize: 12 },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },

  leaveBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#ff4444",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  leaveBtnText: { color: "#ff4444", fontWeight: "900" },
});
