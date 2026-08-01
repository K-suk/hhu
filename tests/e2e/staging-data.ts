import { createClient } from "@supabase/supabase-js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getStagingConfiguration() {
  const url = process.env.E2E_SUPABASE_URL;
  const anonKey = process.env.E2E_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  const userIds = [process.env.E2E_USER_1_ID, process.env.E2E_USER_2_ID];
  const users = [
    {
      email: process.env.E2E_USER_1_EMAIL,
      password: process.env.E2E_USER_1_PASSWORD,
    },
    {
      email: process.env.E2E_USER_2_EMAIL,
      password: process.env.E2E_USER_2_PASSWORD,
    },
  ];

  if (
    !url ||
    !anonKey ||
    !serviceRoleKey ||
    userIds.some((id) => !id) ||
    users.some(({ email, password }) => !email || !password)
  ) {
    return null;
  }
  if (!userIds.every((id) => UUID_PATTERN.test(id!))) {
    throw new Error("E2E user IDs must be explicit UUIDs.");
  }
  if (userIds[0] === userIds[1]) {
    throw new Error("E2E user IDs must be distinct.");
  }

  return {
    url,
    anonKey,
    serviceRoleKey,
    userIds: userIds as [string, string],
    users: users as [
      { email: string; password: string },
      { email: string; password: string },
    ],
  };
}

function assertNoError(operation: string, error: { message: string } | null) {
  if (error) throw new Error(`${operation} failed: ${error.message}`);
}

export function hasStagingDataConfiguration() {
  return getStagingConfiguration() !== null;
}

export async function resetDedicatedE2EData() {
  const config = getStagingConfiguration();
  if (!config) return;

  const supabase = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [firstUserId, secondUserId] = config.userIds;
  const participantFilter =
    `user_1.eq.${firstUserId},user_2.eq.${firstUserId},` +
    `user_1.eq.${secondUserId},user_2.eq.${secondUserId}`;
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id")
    .or(participantFilter);
  assertNoError("Finding dedicated E2E matches", matchesError);

  const matchIds = (matches ?? []).map(({ id }) => id);
  if (matchIds.length > 0) {
    const { error: messageError } = await supabase
      .from("messages")
      .delete()
      .in("match_id", matchIds);
    assertNoError("Deleting dedicated E2E messages", messageError);

    const { error: ratingError } = await supabase
      .from("ratings")
      .delete()
      .in("match_id", matchIds);
    assertNoError("Deleting dedicated E2E ratings", ratingError);

    const { error: matchError } = await supabase
      .from("matches")
      .delete()
      .in("id", matchIds);
    assertNoError("Deleting dedicated E2E matches", matchError);
  }

  const { error: queueError } = await supabase
    .from("queues")
    .delete()
    .in("user_id", config.userIds);
  assertNoError("Deleting dedicated E2E queues", queueError);

  for (const user of config.users) {
    const userClient = createClient(config.url, config.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await userClient.auth.signInWithPassword(user);
    assertNoError("Signing in a dedicated E2E user for reset", signInError);
    const { error: profileError } = await userClient.rpc("set_profile_idle");
    assertNoError("Resetting a dedicated E2E profile", profileError);
    await userClient.auth.signOut();
  }
}
