// ===== 用户认证模块 =====
// 使用Supabase Auth进行用户管理，支持邮箱密码登录注册

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 浏览器端认证客户端
export function getAuthClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

// 检查认证是否可用
export function isAuthConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

// 注册
export async function signUp(email: string, password: string) {
  const client = getAuthClient();
  if (!client) {
    return { user: null, error: { message: '认证服务未配置' } };
  }
  const { data, error } = await client.auth.signUp({
    email,
    password,
  });
  return { user: data.user, error };
}

// 登录
export async function signIn(email: string, password: string) {
  const client = getAuthClient();
  if (!client) {
    return { user: null, error: { message: '认证服务未配置' } };
  }
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  return { user: data.user, error };
}

// 登出
export async function signOut() {
  const client = getAuthClient();
  if (!client) return;
  await client.auth.signOut();
}

// 获取当前用户
export async function getCurrentUser() {
  const client = getAuthClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user;
}

// 获取当前会话
export async function getSession() {
  const client = getAuthClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}
