export type PasswordUpdateClient = Readonly<{
  auth: Readonly<{
    updateUser: (payload: { password: string }) => Promise<{ error: unknown | null }>;
  }>;
}>;

export async function updateCurrentUserPassword(client: PasswordUpdateClient, password: string): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    const { error } = await client.auth.updateUser({ password });
    return error ? { ok: false, error } : { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
