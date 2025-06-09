// room.tsx
"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
} from "@liveblocks/react/suspense";
import { useParams } from "next/navigation";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { getUsers, getDocuments } from "./action";
import { toast } from "sonner";
import { Id } from "../../../../convex/_generated/dataModel";
import { LEFT_MARGIN_DEFAULT, RIGHT_MARGIN_DEFAULT } from "@/constants/margins";

type User = { id: string; name: string; avatar: string; color: string };

export function Room({ children }: { children: ReactNode }) {
  const params = useParams();
  console.log("Room component: Component rendered.");
  console.log(
    "Room component: Initial document ID from params:",
    params.documentId
  );

  const [users, setUsers] = useState<User[]>([]);

  const fetchUsers = useMemo(
    () => async () => {
      console.log("Room component: Attempting to fetch users...");
      try {
        const list = await getUsers();
        setUsers(list);
        console.log("Room component: Users fetched successfully:", list);
      } catch (error) {
        // Catch the error to log it properly
        toast.error("Failed to fetch users");
        console.error("Room component: Error fetching users:", error); // Log the actual error
      }
    },
    []
  );

  useEffect(() => {
    console.log(
      "Room component: useEffect triggered (fetching users on mount)."
    );
    fetchUsers();
  }, [fetchUsers]);

  return (
    <LiveblocksProvider
      throttle={16}
      authEndpoint={async () => {
        const endpoint = "/api/liveblocks-auth";
        const room = params.documentId as string;

        console.log("LiveblocksProvider: Calling authEndpoint.");
        console.log("LiveblocksProvider: Auth endpoint URL:", endpoint);
        console.log(
          "LiveblocksProvider: Room ID being sent to authEndpoint:",
          room
        );

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json", // Important for your server to parse body
          },
          body: JSON.stringify({ room }),
        });

        console.log(
          "LiveblocksProvider: Auth endpoint response status:",
          response.status
        );

        if (!response.ok) {
          // Read response as text or JSON, depending on what your server sends for errors
          const errorBody = await response.text(); // Or response.json() if your error is JSON
          console.error("Liveblocks auth failed:", response.status, errorBody);
          // Propagate the error correctly so Liveblocks retries or gives up gracefully
          throw new Error(
            `Liveblocks authentication failed: ${response.status} - ${errorBody}`
          );
        }
        console.log(
          "LiveblocksProvider: Auth endpoint response OK. Parsing JSON."
        );
        const authJson = await response.json();
        console.log(
          "LiveblocksProvider: Auth endpoint JSON received (token not logged for security)."
        );
        return authJson;
      }}
      resolveUsers={({ userIds }) => {
        console.log(
          "LiveblocksProvider: resolveUsers called for user IDs:",
          userIds
        );
        const resolvedUsers = userIds.map(
          (userId) => users.find((user) => user.id === userId) ?? undefined
        );
        console.log(
          "LiveblocksProvider: resolveUsers resolved:",
          resolvedUsers
        );
        return resolvedUsers;
      }}
      resolveMentionSuggestions={({ text }) => {
        console.log(
          "LiveblocksProvider: resolveMentionSuggestions called with text:",
          text
        );
        let filteredUsers = users;

        if (text) {
          filteredUsers = users.filter((user) =>
            user.name.toLowerCase().includes(text.toLowerCase())
          );
        }
        const suggestedIds = filteredUsers.map((user) => user.id);
        console.log(
          "LiveblocksProvider: resolveMentionSuggestions suggested IDs:",
          suggestedIds
        );
        return suggestedIds;
      }}
      resolveRoomsInfo={async ({ roomIds }) => {
        console.log(
          "LiveblocksProvider: resolveRoomsInfo called for room IDs:",
          roomIds
        );
        const documents = await getDocuments(roomIds as Id<"documents">[]);
        const roomInfo = documents.map((document) => ({
          id: document.id,
          name: document.name,
        }));
        console.log("LiveblocksProvider: resolveRoomsInfo resolved:", roomInfo);
        return roomInfo;
      }}
    >
      <RoomProvider
        id={params.documentId as string}
        initialStorage={() => {
          console.log("RoomProvider: initialStorage factory function called.");
          // IMPORTANT: As per your request, createYjsDoc() is NOT added here.
          // This means the Yjs document (for Tiptap content) will NOT be
          // initialized in Liveblocks Storage by this component.
          // This will likely cause collaboration issues for document content.
          return {
            leftMargin: LEFT_MARGIN_DEFAULT,
            rightMargin: RIGHT_MARGIN_DEFAULT,
          };
        }}
      >
        <ClientSideSuspense
          fallback={<FullscreenLoader label="Room loading..." />}
        >
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
