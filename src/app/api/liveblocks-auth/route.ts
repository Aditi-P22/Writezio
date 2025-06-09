// src/app/api/liveblocks-auth/route.ts (or pages/api/liveblocks-auth.ts)

import { Liveblocks } from "@liveblocks/node";
import { ConvexHttpClient } from "convex/browser";
import { auth, currentUser } from "@clerk/nextjs/server";
import { api } from "../../../../convex/_generated/api";

console.log("Liveblocks Auth: Initializing API route.");

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function POST(req: Request) {
  console.log("\n--- New Liveblocks Auth Request Received ---");
  console.log("Liveblocks Auth: Checking Clerk authentication claims.");
  const { sessionClaims } = await auth();

  if (!sessionClaims) {
    console.log(
      "Liveblocks Auth: No session claims found. Returning 401 Unauthorized."
    );
    return new Response("Unauthorized", { status: 401 });
  }
  console.log("Liveblocks Auth: Session claims found. User authenticated.");
  console.log(
    "Liveblocks Auth: sessionClaims object:",
    JSON.stringify(sessionClaims, null, 2)
  );

  console.log("Liveblocks Auth: Fetching current user details from Clerk.");
  const user = await currentUser();

  if (!user) {
    console.log(
      "Liveblocks Auth: No current user found. Returning 401 Unauthorized."
    );
    return new Response("Unauthorized", { status: 401 });
  }
  console.log(`Liveblocks Auth: Current user found. User ID: ${user.id}`);

  console.log("Liveblocks Auth: Parsing request body for room ID.");
  const { room } = await req.json();
  console.log(`Liveblocks Auth: Room ID received: ${room}`);

  console.log(`Liveblocks Auth: Querying Convex for document with ID: ${room}`);
  const document = await convex.query(api.documents.getById, { id: room });

  if (!document) {
    console.log(
      `Liveblocks Auth: Document with ID ${room} not found. Returning 401 Unauthorized.`
    );
    return new Response("Unauthorized", { status: 401 });
  }
  console.log("Liveblocks Auth: Document found.");
  console.log(
    "Liveblocks Auth: Retrieved document object:",
    JSON.stringify(document, null, 2)
  );

  console.log(
    "Liveblocks Auth: Checking authorization: owner and organization membership."
  );
  const isOwner = document.ownerId === user.id;

  // --- THIS IS THE CORRECTED SECTION ---
  // The 'as { id: string }' tells TypeScript that if 'sessionClaims.o' exists,
  // it should be treated as an object that has an 'id' property of type string.
  const isOrganizationMember = !!(
    document.organizationId &&
    sessionClaims.o &&
    (sessionClaims.o as { id: string }).id && // Assert 'o' has an 'id' property, then check if 'id' is truthy
    document.organizationId === (sessionClaims.o as { id: string }).id // Compare IDs after assertion
  );
  // --- END CORRECTED SECTION ---

  console.log(`Liveblocks Auth: Is owner: ${isOwner}`);
  console.log(
    `Liveblocks Auth: Is organization member: ${isOrganizationMember}`
  );

  if (!isOwner && !isOrganizationMember) {
    console.log(
      "Liveblocks Auth: User is not owner and not an organization member. Returning 401 Unauthorized."
    );
    return new Response("Unauthorized", { status: 401 });
  }
  console.log(
    "Liveblocks Auth: User is authorized (owner or organization member)."
  );

  console.log("Liveblocks Auth: Preparing Liveblocks session.");
  const name =
    user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Anonymous";
  const nameToNumber = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = Math.abs(nameToNumber) % 360;
  const color = `hsl(${hue}, 80%, 60%)`;

  console.log(
    `Liveblocks Auth: User info for session - Name: "${name}", Avatar: "${user.imageUrl}", Color: "${color}"`
  );

  const session = liveblocks.prepareSession(user.id, {
    userInfo: {
      name,
      avatar: user.imageUrl,
      color,
    },
  });

  console.log(`Liveblocks Auth: Allowing FULL_ACCESS to room: ${room}`);
  session.allow(room, session.FULL_ACCESS);

  console.log("Liveblocks Auth: Authorizing session with Liveblocks service.");
  const { body, status } = await session.authorize();

  console.log(
    `Liveblocks Auth: Final authorization response status: ${status}`
  );

  console.log("Liveblocks Auth: Returning final response to client.");
  return new Response(body, { status });
}
