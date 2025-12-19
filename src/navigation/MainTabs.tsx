
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";

import HomeStack from "./HomeStack";
import GroupScreen from "../screens/GroupScreen";
import TasksScreen from "../screens/TasksScreen";
import AssignmentsScreen from "../screens/AssignmentsScreen";
import ProfileScreen from "../screens/ProfileScreen";

export type MainTabParamList = {
  HomeTab: undefined;
  TasksTab: undefined;
  GroupsTab: undefined;
  AssignmentsTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: "#f5c6c6",
        tabBarStyle: {
          backgroundColor: "#b00020",
          borderTopWidth: 0,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: any = "home";

          if (route.name === "HomeTab") iconName = "home";
          else if (route.name === "TasksTab") iconName = "checkbox-outline";
          else if (route.name === "GroupsTab") iconName = "people-outline";
          else if (route.name === "AssignmentsTab") iconName = "book-outline";
          else if (route.name === "ProfileTab") iconName = "person-circle-outline";

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="TasksTab" component={TasksScreen} options={{ title: "Tasks" }} />
      <Tab.Screen name="GroupsTab" component={GroupScreen} options={{ title: "Groups" }} />
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: "Home" }} />
      <Tab.Screen
        name="AssignmentsTab"
        component={AssignmentsScreen}
        options={{ title: "Assignments" }}
      />

      
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={({ navigation }) => ({
          title: "Profile",
          headerShown: true,
          headerStyle: { backgroundColor: "#111" },
          headerTitleStyle: { color: "#fff", fontWeight: "900" },
          headerTintColor: "#fff",

          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginRight: 14 }}>
             
              <TouchableOpacity
                onPress={() => navigation.getParent()?.navigate("Notifications" as never)}
              >
                <Ionicons name="notifications-outline" size={22} color="#fff" />
              </TouchableOpacity>

              
              <TouchableOpacity onPress={() => navigation.navigate("ProfileTab")}>
                <Ionicons name="person-circle-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ),
        })}
      />
    </Tab.Navigator>
  );
}
