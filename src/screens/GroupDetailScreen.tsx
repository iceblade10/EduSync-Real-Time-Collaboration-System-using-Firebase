import React from "react";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import GroupFilesTab from "./tabs/GroupFilesTab";
import GroupTasksTab from "./tabs/GroupTasksTab";
import GroupAssignmentsTab from "./tabs/GroupAssignmentsTab";

export type GroupDetailParams = {
  groupId: string;
  groupName: string;
};

export type GroupDetailTabParamList = {
  Files: GroupDetailParams;
  Tasks: GroupDetailParams;
  Assignments: GroupDetailParams;
};

const Tab = createMaterialTopTabNavigator<GroupDetailTabParamList>();

export default function GroupDetailScreen({ route }: any) {
  const { groupId, groupName } = route.params as GroupDetailParams;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: "#111" },
        tabBarIndicatorStyle: { backgroundColor: "#ff4444" },
        tabBarLabelStyle: { color: "#fff", fontWeight: "700" },
      }}
    >
      <Tab.Screen
        name="Files"
        component={GroupFilesTab}
        initialParams={{ groupId, groupName }}
      />
      <Tab.Screen
        name="Tasks"
        component={GroupTasksTab}
        initialParams={{ groupId, groupName }}
      />
      <Tab.Screen
        name="Assignments"
        component={GroupAssignmentsTab}
        initialParams={{ groupId, groupName }}
      />
    </Tab.Navigator>
  );
}
