// Deletes the signed-in user's account. Their rows go with it (every table
// references auth.users with "on delete cascade").
import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const { error: e } = await createAdminClient().auth.admin.deleteUser(data.user.id);
    if (e) throw e;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn’t delete the account" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
