import { supabase } from '@/integrations/supabase/client';

// Admin database writes go through the `admin-write` edge function, which checks the signed
// admin token from `verify-admin`. Public clients only have read access to the game tables.
//
// Usage mirrors the Supabase query builder for the subset the app needs:
//   await adminDb.from('participants').update({ is_locked: true }).eq('id', id);
//   const { data } = await adminDb.from('voting_sessions').insert({...}).select().single();

const TOKEN_KEY = 'admin_token';
export const ADMIN_AUTH_EXPIRED_EVENT = 'admin-auth-expired';

type Action = 'insert' | 'update' | 'delete';
type FilterOp = 'eq' | 'neq' | 'is' | 'in';
type Returning = 'none' | 'rows' | 'single';
type Row = Record<string, unknown>;

export interface AdminWriteOp {
  table: string;
  action: Action;
  values?: Row | Row[];
  filters: [string, FilterOp, unknown][];
  returning: Returning;
}

export interface AdminWriteResult<T = unknown> {
  data: T | null;
  error: Error | null;
}

export const getAdminToken = (): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAdminToken = (token: string | null) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable (private mode) – the admin simply has to log in again
  }
};

/** Sends one or more write operations (executed in order, stopping at the first error). */
export async function adminWrite(ops: AdminWriteOp[]): Promise<AdminWriteResult<unknown[]>> {
  const { data, error } = await supabase.functions.invoke('admin-write', {
    body: { ops },
    headers: { 'x-admin-token': getAdminToken() ?? '' },
  });

  if (error) {
    const status = (error as { context?: Response }).context?.status;
    if (status === 401) {
      setAdminToken(null);
      window.dispatchEvent(new Event(ADMIN_AUTH_EXPIRED_EVENT));
    }
    console.error('admin-write failed:', error);
    return { data: null, error: error as Error };
  }

  const results = (data?.results ?? []) as { data: unknown; error: { message: string } | null }[];
  const failed = results.find((r) => r.error);
  if (failed) {
    console.error('admin-write operation failed:', failed.error);
    return { data: null, error: new Error(failed.error!.message) };
  }
  return { data: results.map((r) => r.data), error: null };
}

class AdminWriteBuilder<T = unknown> implements PromiseLike<AdminWriteResult<T>> {
  private op: AdminWriteOp;

  constructor(table: string, action: Action, values?: Row | Row[]) {
    this.op = { table, action, values, filters: [], returning: 'none' };
  }

  eq(column: string, value: unknown) { return this.filter(column, 'eq', value); }
  neq(column: string, value: unknown) { return this.filter(column, 'neq', value); }
  is(column: string, value: null | boolean) { return this.filter(column, 'is', value); }
  in(column: string, values: unknown[]) { return this.filter(column, 'in', values); }

  select() {
    this.op.returning = 'rows';
    return this;
  }

  single<R = Row>() {
    this.op.returning = 'single';
    return this as unknown as AdminWriteBuilder<R>;
  }

  /** The raw operation, e.g. to send several in one request with `adminWrite`. */
  toOp(): AdminWriteOp {
    return this.op;
  }

  then<R1 = AdminWriteResult<T>, R2 = never>(
    onFulfilled?: ((value: AdminWriteResult<T>) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const run = async (): Promise<AdminWriteResult<T>> => {
      const { data, error } = await adminWrite([this.op]);
      return { data: (data?.[0] ?? null) as T | null, error };
    };
    return run().then(onFulfilled, onRejected);
  }

  private filter(column: string, op: FilterOp, value: unknown) {
    this.op.filters.push([column, op, value]);
    return this;
  }
}

export const adminDb = {
  from(table: string) {
    return {
      insert: (values: Row | Row[]) => new AdminWriteBuilder(table, 'insert', values),
      update: (values: Row) => new AdminWriteBuilder(table, 'update', values),
      delete: () => new AdminWriteBuilder(table, 'delete'),
    };
  },
};
