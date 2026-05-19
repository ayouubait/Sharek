import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  resource_id?: string;
  resource_type?: string;
  resource_type_label?: string;
  read: boolean;
  created_at: string;
}

export function useRealtimeNotifications(userId: string | undefined) {
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        // Charger les types de ressources liées pour enrichir le contexte
        const resourceIds = [...new Set(data.filter((n) => n.resource_id).map((n) => n.resource_id))];
        let resourceMap: Record<string, { type: string; type_label: string }> = {};
        if (resourceIds.length > 0) {
          try {
            const { data: resourcesData } = await supabase
              .from('resources')
              .select('id, type, type_label')
              .in('id', resourceIds);
            if (resourcesData) {
              resourceMap = Object.fromEntries(
                resourcesData.map((r) => [r.id, { type: r.type, type_label: r.type_label }])
              );
            }
          } catch {
            // Silencieux — les notifs fonctionnent sans le type
          }
        }

        setNotifs(
          data.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            resource_id: n.resource_id,
            resource_type: resourceMap[n.resource_id]?.type,
            resource_type_label: resourceMap[n.resource_id]?.type_label,
            read: n.read,
            created_at: n.created_at,
          }))
        );
      }
    } catch {
      // Silencieux — le realtime prendra le relais
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();

    if (!userId) return;

    // Cleanup previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as NotificationItem;
          // Si la notif a un resource_id, essayer de récupérer le type
          if (newNotif.resource_id) {
            supabase
              .from('resources')
              .select('type, type_label')
              .eq('id', newNotif.resource_id)
              .single()
              .then(({ data }) => {
                if (data) {
                  newNotif.resource_type = data.type;
                  newNotif.resource_type_label = data.type_label;
                }
                setNotifs((prev) => {
                  if (prev.some((n) => n.id === newNotif.id)) return prev;
                  return [newNotif, ...prev];
                });
              })
              .catch(() => {
                setNotifs((prev) => {
                  if (prev.some((n) => n.id === newNotif.id)) return prev;
                  return [newNotif, ...prev];
                });
              });
          } else {
            setNotifs((prev) => {
              if (prev.some((n) => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as NotificationItem;
          setNotifs((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setNotifs((prev) => prev.filter((n) => n.id !== deleted.id));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, fetchNotifications]);

  const markAsRead = useCallback(
    async (notifId: string) => {
      setNotifs((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
      try {
        await supabase.from('notifications').update({ read: true }).eq('id', notifId);
      } catch {
        // Silencieux
      }
    },
    []
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
    } catch {
      // Silencieux
    }
  }, [userId]);

  const unreadCount = notifs.filter((n) => !n.read).length;

  return {
    notifs,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}