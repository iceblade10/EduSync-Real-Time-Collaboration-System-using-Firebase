import React from "react";
import { StatusBar } from 'expo-status-bar';
import AppNavigator from "./src/navigation/AppNavigator";
// import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <AppNavigator />
    </>
  );
}