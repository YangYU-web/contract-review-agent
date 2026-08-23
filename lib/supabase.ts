import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 浏览器端客户端（受RLS策略保护）
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

// 服务端客户端（使用service role key，绕过RLS）
export function getSupabaseServer(): SupabaseClient | null {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

// 检查Supabase是否已配置
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

// 生成模拟用户ID（当没有认证时使用）
export function getMockUserId(): string {
  if (typeof window === 'undefined') return 'mock-user-server';
  let userId = localStorage.getItem('mock_user_id');
  if (!userId) {
    userId = 'mock-user-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('mock_user_id', userId);
  }
  return userId;
}
