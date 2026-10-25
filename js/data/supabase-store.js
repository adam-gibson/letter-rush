// Supabase implementation: custom categories live in the database (table
// `custom_categories`, see supabase/schema.sql). Settings and the game in
// progress stay on the device, inherited from LocalStore.
import { LocalStore, read, write } from './local-store.js';

export class SupabaseStore extends LocalStore {
  constructor(client, user) {
    super();
    this.client = client;
    this.user = user;
    this.cacheKey = `letterRush.remoteCategories.${user.id}`;
  }

  async listCustomCategories() {
    const { data, error } = await this.client
      .from('custom_categories')
      .select('id, name, created_at')
      .order('created_at');
    if (error) {
      // Offline: fall back to the last list we fetched.
      const cached = read(this.cacheKey, null);
      if (cached) return cached;
      throw error;
    }
    const list = data.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
    write(this.cacheKey, list);
    return list;
  }

  async addCustomCategory(name) {
    const { data, error } = await this.client
      .from('custom_categories')
      .insert({ name })
      .select('id, name, created_at')
      .single();
    if (error) throw error;
    return { id: data.id, name: data.name, createdAt: data.created_at };
  }

  async deleteCustomCategory(id) {
    const { error } = await this.client.from('custom_categories').delete().eq('id', id);
    if (error) throw error;
  }

  /** First sign-in on this device: copy local categories up to the account. */
  async importLocalCategories(localList) {
    const flag = `letterRush.imported.${this.user.id}`;
    if (read(flag, false) || !localList.length) return;
    const existing = new Set((await this.listCustomCategories()).map((c) => c.name.toLowerCase()));
    const rows = localList
      .filter((c) => !existing.has(c.name.toLowerCase()))
      .map((c) => ({ name: c.name }));
    if (rows.length) {
      const { error } = await this.client.from('custom_categories').insert(rows);
      if (error) throw error;
    }
    write(flag, true);
  }
}
