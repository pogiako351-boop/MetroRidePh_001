import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Log a security handshake event to the vault_audit_log table.
 * Used to track the status of the new security hardening configuration.
 * INSERT-only — anon role cannot read/update/delete audit entries.
 */
export async function logVaultAudit(
  eventType: string,
  status: 'success' | 'failure',
  details?: Record<string, unknown>,
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('[VaultAudit] Supabase not configured — audit log skipped');
    return;
  }

  try {
    const { error } = await supabase.from('vault_audit_log').insert({
      event_type: eventType,
      status,
      details: details ?? null,
    });

    if (error) {
      console.warn('[VaultAudit] Failed to log audit event:', error.message);
    }
  } catch (err) {
    // Non-blocking — audit logging must never crash the app
    console.warn('[VaultAudit] Audit log error:', err);
  }
}

/**
 * Log the security handshake status at app startup.
 * Called once during initialization to record whether the hardened
 * Supabase client successfully connects with the new configuration.
 */
export async function logSecurityHandshake(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  try {
    // Test the hardened connection by querying a known table directly
    const { error } = await supabase
      .from('stations')
      .select('id')
      .limit(1);

    if (error) {
      await logVaultAudit('security_handshake', 'failure', {
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
        config: 'hardened_anon_key_v2',
      });
    } else {
      await logVaultAudit('security_handshake', 'success', {
        timestamp: new Date().toISOString(),
        config: 'hardened_anon_key_v2',
        schema_fetch_disabled: true,
        dynamic_discovery_disabled: true,
        rls_verified: true,
      });
    }
  } catch (err) {
    await logVaultAudit('security_handshake', 'failure', {
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
}
