
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/config";
import { RootStackParamList } from "../navigation/AppNavigator";
import  AsyncStorage  from "@react-native-async-storage/async-storage";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
  if (!email || !password) {
    Alert.alert("Error", "Please enter email and password.");
    return;
  }

  try {
    setLoading(true);

    const userCredential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    
     const firebaseIdToken = await userCredential.user.getIdToken();

     await AsyncStorage.setItem("firebase_id_token", firebaseIdToken);

    
  } catch (err: any) {
    console.error(err);
    Alert.alert("Login failed", err.message ?? "Something went wrong.");
  } finally {
    setLoading(false);
  }
}


  return (
    <View style={styles.container}>
      <Text style={styles.title}>EduSync</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Button title={loading ? "Signing in..." : "Sign In"} onPress={handleLogin} />

      <TouchableOpacity
        style={{ marginTop: 16 }}
        onPress={() => navigation.navigate("Register")}
      >
        <Text style={styles.linkText}>Don’t have an account? Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 16, color: "#666", marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  linkText: { color: "#0066cc", textAlign: "center" },
});
