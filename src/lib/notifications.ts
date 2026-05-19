import { supabase } from '@/lib/supabase';

interface CreateNotificationPayload {
  user_id: string;
  type: 'comment' | 'review' | 'recommendation' | 'resource' | 'system';
  title: string;
  message: string;
  resource_id?: string;
}

export async function createNotification(payload: CreateNotificationPayload): Promise<boolean> {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: payload.user_id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      resource_id: payload.resource_id || null,
      read: false,
    });
    return !error;
  } catch {
    return false;
  }
}