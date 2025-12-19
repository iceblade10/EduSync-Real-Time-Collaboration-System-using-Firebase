
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { auth, db } from "../firebase/config";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

type ThemeMode = "dark" | "light";

type UserPrefs = {
  notifyFile: boolean;
  notifyTask: boolean;
  notifyAssignment: boolean;
  notifyGroup: boolean;
};

type UserProfileDoc = {
  displayName?: string;
  email?: string;
  theme?: ThemeMode;
  prefs?: Partial<UserPrefs>;
};

const DEFAULT_PREFS: UserPrefs = {
  notifyFile: true,
  notifyTask: true,
  notifyAssignment: true,
  notifyGroup: true,
};

const THEME_KEY = "edusync_theme";

export default function ProfileScreen() {
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        
        const localTheme = (await AsyncStorage.getItem(THEME_KEY)) as ThemeMode | null;
        if (localTheme === "dark" || localTheme === "light") setTheme(localTheme);

        
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        const fallbackName = user.displayName ?? "";
        const fallbackEmail = user.email ?? "";

        if (snap.exists()) {
          const data = snap.data() as UserProfileDoc;

          setDisplayName(data.displayName ?? fallbackName);
          setEmail(data.email ?? fallbackEmail);

          const mergedPrefs: UserPrefs = { ...DEFAULT_PREFS, ...(data.prefs ?? {}) };
          setPrefs(mergedPrefs);

          if (data.theme === "dark" || data.theme === "light") {
            setTheme(data.theme);
            await AsyncStorage.setItem(THEME_KEY, data.theme);
          }
        } else {
         
          setDisplayName(fallbackName);
          setEmail(fallbackEmail);

          await setDoc(
            userRef,
            {
              displayName: fallbackName,
              email: fallbackEmail,
              theme: localTheme ?? "dark",
              prefs: DEFAULT_PREFS,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [user?.uid]);

  const toggleTheme = async () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    await AsyncStorage.setItem(THEME_KEY, next);

    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          theme: next,
          updatedAt: serverTimestamp(),
        });
      } catch {
        
      }
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    const name = displayName.trim();
    if (!name) {
      Alert.alert("Validation", "Display name cannot be empty.");
      return;
    }

    try {
      setSaving(true);
      await updateDoc(doc(db, "users", user.uid), {
        displayName: name,
        prefs,
        theme,
        updatedAt: serverTimestamp(),
      });
      Alert.alert("Saved", "Profile & preferences updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    Alert.alert("Log out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed to log out");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading profile…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Not logged in</Text>
      </View>
    );
  }

  const initial = (displayName || user.displayName || user.email || "U")
    .trim()
    .slice(0, 1)
    .toUpperCase();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }} 
      >
        <Text style={styles.header}>Profile & Preferences</Text>

     
        <View style={styles.avatarRow}>
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>

          <View style={styles.photoDisabled}>
            <Text style={styles.photoDisabledText}>Photo disabled</Text>
          </View>
        </View>

      
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>

          <Text style={styles.label}>Display Name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={theme === "dark" ? "#777" : "#999"}
            style={styles.input}
          />

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{email || user.email || "-"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <View style={styles.row}>
            <Text style={styles.rowText}>Theme: {theme === "dark" ? "Dark" : "Light"}</Text>
            <Switch value={theme === "light"} onValueChange={toggleTheme} />
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Notification Preferences</Text>

          <PrefRow
            label="File uploads"
            value={prefs.notifyFile}
            onChange={(v) => setPrefs((p) => ({ ...p, notifyFile: v }))}
            styles={styles}
          />
          <PrefRow
            label="Tasks"
            value={prefs.notifyTask}
            onChange={(v) => setPrefs((p) => ({ ...p, notifyTask: v }))}
            styles={styles}
          />
          <PrefRow
            label="Assignments"
            value={prefs.notifyAssignment}
            onChange={(v) => setPrefs((p) => ({ ...p, notifyAssignment: v }))}
            styles={styles}
          />
          <PrefRow
            label="Group activity"
            value={prefs.notifyGroup}
            onChange={(v) => setPrefs((p) => ({ ...p, notifyGroup: v }))}
            styles={styles}
          />
        </View>

      
        <TouchableOpacity style={styles.btnPrimary} onPress={saveProfile} disabled={saving}>
          <Text style={styles.btnPrimaryText}>{saving ? "Saving..." : "Save Changes"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnDanger} onPress={logout}>
          <Text style={styles.btnDangerText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PrefRow({
  label,
  value,
  onChange,
  styles,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  styles: any;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function makeStyles(theme: ThemeMode) {
  const dark = theme === "dark";
  const bg = dark ? "#111" : "#f5f5f5";
  const card = dark ? "#222" : "#fff";
  const text = dark ? "#fff" : "#111";
  const muted = dark ? "#aaa" : "#666";

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: bg, padding: 16 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: bg },

    header: { color: text, fontSize: 20, fontWeight: "900", marginBottom: 14 },

    avatarRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
    avatarPlaceholder: { backgroundColor: dark ? "#333" : "#ddd" },
    avatarInitial: { color: text, fontSize: 22, fontWeight: "900" },

    photoDisabled: {
      borderWidth: 1,
      borderColor: dark ? "#444" : "#bbb",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      opacity: 0.75,
    },
    photoDisabledText: { color: muted, fontWeight: "800" },

    card: { backgroundColor: card, padding: 14, borderRadius: 12, marginTop: 12 },
    sectionTitle: { color: text, fontSize: 16, fontWeight: "900", marginBottom: 8 },
    label: { color: muted, marginTop: 10, marginBottom: 6 },
    value: { color: text, fontSize: 15, fontWeight: "700" },

    input: {
      backgroundColor: dark ? "#111" : "#f1f1f1",
      color: text,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: dark ? "#333" : "#ddd",
    },

    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
    },
    rowText: { color: text, fontSize: 14, fontWeight: "700" },

    btnPrimary: { backgroundColor: "#ffffff", padding: 14, borderRadius: 12, marginTop: 14 },
    btnPrimaryText: { color: "#000", fontWeight: "900", textAlign: "center" },

    btnDanger: {
      padding: 14,
      borderRadius: 12,
      marginTop: 10,
      borderWidth: 1,
      borderColor: "#ff4444",
    },
    btnDangerText: { color: "#ff4444", fontWeight: "900", textAlign: "center" },

    title: { color: text, fontSize: 18, fontWeight: "900" },
    muted: { color: muted, marginTop: 10 },
  });
}