

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as WebBrowser from "expo-web-browser";
import { notifyGroupMembers } from "../../firebase/notifications"; 
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase/config";

type FileItem = {
  id: string;
  fileName: string;
  storagePath: string;
  uploadedBy: string;
  createdAt?: any;
  contentType?: string;
  size?: number;
};

export default function GroupFilesTab({ route }: any) {
  const { groupId } = route.params;
  const [files, setFiles] = useState<FileItem[]>([]);

  
  const SUPABASE_FUNCTION_URL =
    "https://wgwvxaafsigrolbhsgqe.supabase.co/functions/v1/firebase-bridge";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnd3Z4YWFmc2lncm9sYmhzZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzA1NDksImV4cCI6MjA4MTMwNjU0OX0.D0HwuBEGdnbH1i-gpYBoo6d8tVFN0dtE2g35gXlBW6I";

  useEffect(() => {
    const filesRef = collection(db, "groups", groupId, "files");
    const q = query(filesRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: FileItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            fileName: data.fileName,
            storagePath: data.storagePath ?? "",
            uploadedBy: data.uploadedBy ?? "",
            createdAt: data.createdAt,
            contentType: data.contentType,
            size: data.size,
          });
        });
        setFiles(list);
      },
      (err) => {
        console.error(err);
        Alert.alert("Error", "Failed to load files in real time.");
      }
    );

    return () => unsub();
  }, [groupId]);

  async function handleUpload() {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "You must be logged in.");
        return;
      }

      console.log("UPLOAD[1]: button pressed");

      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      console.log("UPLOAD[4]: picker result =", result);

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Error", "File pick failed (no uri).");
        return;
      }

      const fileName = asset.name ?? `file-${Date.now()}`;
      const uri = asset.uri;

      console.log("UPLOAD[6]: selected file =", {
        fileName,
        mimeType: asset.mimeType,
        size: asset.size,
        uri,
      });

      const firebaseToken = await user.getIdToken(true);
      console.log("UPLOAD[8]: firebase token length =", firebaseToken?.length);

     
      console.log("UPLOAD[8.5]: starting base64 conversion...");
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      console.log("UPLOAD[9]: base64 length =", base64.length);

      const path = `${user.uid}/${Date.now()}-${fileName}`;
      console.log("UPLOAD[10]: uploading to path =", path);

      const res = await fetch(SUPABASE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "x-firebase-token": firebaseToken,
        },
        
        body: JSON.stringify({
          filePath: path,
          base64,
          contentType: asset.mimeType ?? "application/octet-stream",
        }),
      });

      console.log("UPLOAD[11]: response status =", res.status);
      const respJson = await res.json().catch(() => null);
      console.log("UPLOAD[12]: response body =", respJson);

      if (!res.ok || !respJson?.success || !respJson?.filePath) {
        Alert.alert("Upload failed", respJson?.error ?? `HTTP ${res.status}`);
        return;
      }

      const uploadedPath = String(respJson.filePath);
      console.log("UPLOAD[14]: uploadedPath =", uploadedPath);

      
      await addDoc(collection(db, "groups", groupId, "files"), {
        fileName,
        storagePath: uploadedPath, 
        url: "", 
        uploadedBy: user.displayName || user.email || user.uid,
        uploadedByUid: user.uid,
        createdAt: serverTimestamp(),
        provider: "supabase",
        contentType: asset.mimeType ?? "application/octet-stream",
        size: asset.size ?? null,
      });

      await notifyGroupMembers({
  groupId,
  actorUid: user.uid,
  type: "file",
  title: "New file uploaded",
  message: fileName,
  target: {
    screen: "GroupDetail",
    params: { groupId, groupName: route.params?.groupName, initialTab: "Files" },
  },
});


      console.log("UPLOAD[16]: firestore doc written");
      Alert.alert("Uploaded", `${fileName} uploaded successfully.`);
    } catch (e: any) {
      console.log("UPLOAD ERROR:", e);
      Alert.alert("Upload failed", e?.message ?? "Unknown error");
    }
  }

  const openFile = async (storagePath: string) => {
    try {
      if (!storagePath) {
        Alert.alert("Error", "Missing storagePath");
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Auth error", "Please login again.");
        return;
      }

      
      const firebaseToken = await user.getIdToken(true);
      if (!firebaseToken) {
        Alert.alert("Auth error", "Firebase token missing. Please login again.");
        return;
      }

      const res = await fetch(SUPABASE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "x-firebase-token": firebaseToken,
        },
        body: JSON.stringify({
          action: "sign",
          filePath: storagePath,
          expiresIn: 60 * 10, 
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.signedUrl) {
        console.log("OPEN FAILED", res.status, json);
        Alert.alert("Error", json?.error ?? `HTTP ${res.status}`);
        return;
      }

      await WebBrowser.openBrowserAsync(json.signedUrl);
    } catch (e: any) {
      console.log("OPEN FILE ERROR:", e);
      Alert.alert("Open failed", e?.message ?? "Unknown error");
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
        <Text style={styles.uploadText}>Upload File</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Shared Files (Real-time)</Text>

      <FlatList
        data={files}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openFile(item.storagePath)} activeOpacity={0.8}>
            <Text style={styles.fileName}>{item.fileName}</Text>
            <Text style={styles.meta}>Uploaded by: {item.uploadedBy}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No files yet. Upload the first one.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 16 },
  uploadBtn: {
    backgroundColor: "#ff4444",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  uploadText: { color: "#fff", fontWeight: "800" },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 10 },
  card: { backgroundColor: "#222", padding: 12, borderRadius: 12, marginBottom: 10 },
  fileName: { color: "#fff", fontSize: 15, fontWeight: "700" },
  meta: { color: "#aaa", marginTop: 4, fontSize: 12 },
  empty: { color: "#888", marginTop: 10 },
});
