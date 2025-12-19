
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./config";

export type NotificationTarget =
  | { screen: "GroupDetail"; params: { groupId: string; groupName?: string; initialTab?: "Files" | "Tasks" | "Assignments" } }
  | { screen: "Tasks"; params?: {} }
  | { screen: "Assignments"; params?: {} };

export type CreateNotificationInput = {
  groupId: string;
  actorUid: string;
  title: string;
  message: string;
  type: "file" | "task" | "assignment" | "group";
  target: NotificationTarget;
};

export async function notifyGroupMembers(input: CreateNotificationInput) {
  const groupRef = doc(db, "groups", input.groupId);
  const snap = await getDoc(groupRef);

  if (!snap.exists()) throw new Error("Group not found");
  const group = snap.data() as any;

  const members: Array<{ uid: string }> = Array.isArray(group.members) ? group.members : [];
  if (members.length === 0) return;

  await Promise.all(
    members
      .filter((m) => m?.uid && m.uid !== input.actorUid) 
      .map((m) =>
        addDoc(collection(db, "users", m.uid, "notifications"), {
          type: input.type,
          title: input.title,
          message: input.message,
          groupId: input.groupId,
          target: input.target,
          read: false,
          createdAt: serverTimestamp(),
        })
      )
  );
}
