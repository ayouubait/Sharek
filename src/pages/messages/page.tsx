import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { withTimeout } from '@/lib/utils';
import { fetchProfilesMap, getDisplayProfile } from '@/lib/profiles';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Attachment {
  name: string;
  type: string;
  size: number;
  url: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
  read_at?: string;
  attachments?: Attachment[];
}

interface ConversationPreview {
  userId: string;
  name: string;
  initials: string;
  color: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  last_seen?: string;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function isOnline(lastSeen?: string): boolean {
  if (!lastSeen) return false;
  const diff = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
  return diff < 120; // 2 minutes
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function MessagesPage() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id || 't1';
  const currentUserName = user?.name || 'Moi';

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(userId || null);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeAttachments, setActiveAttachments] = useState<Attachment[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [profilesMap, setProfilesMap] = useState<Record<string, import('@/lib/profiles').ProfileInfo>>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUserInfo = useCallback((id: string) => {
    const profile = getDisplayProfile(id, profilesMap);
    if (id === currentUserId) {
      const safeName = (currentUserName || 'Moi').trim() || 'Moi';
      const initials = safeName.split(/\s+/).filter(Boolean).map((n) => n[0] || '').join('').slice(0, 2).toUpperCase() || '??';
      return { name: safeName, initials, color: '#0d9488', avatar_url: null };
    }
    return { name: profile.name, initials: profile.initials, color: profile.color, avatar_url: profile.avatar_url };
  }, [currentUserId, currentUserName, profilesMap]);

  // --- Charger tous les messages + profiles (last_seen) ---
  const loadData = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const [msgRes, profRes] = await Promise.all([
        withTimeout(supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
          .order('created_at', { ascending: true }), 8000),
        withTimeout(supabase
          .from('profiles')
          .select('id, last_seen'), 8000),
      ]);

      const lastSeenMap = new Map<string, string>();
      if (!profRes.error && profRes.data) {
        for (const p of profRes.data as { id: string; last_seen: string | null }[]) {
          if (p.last_seen) lastSeenMap.set(p.id, p.last_seen);
        }
      }

      if (!msgRes.error && msgRes.data) {
        const msgs = msgRes.data as Message[];
        setMessages(msgs);

        const convMap = new Map<string, { lastMessage: string; lastAt: string; unread: number; userId: string }>();
        for (const msg of msgs) {
          const otherId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
          if (!convMap.has(otherId)) {
            convMap.set(otherId, { lastMessage: msg.content || '(Pièce jointe)', lastAt: msg.created_at, unread: 0, userId: otherId });
          }
          const existing = convMap.get(otherId)!;
          if (new Date(msg.created_at) > new Date(existing.lastAt)) {
            existing.lastMessage = msg.content || (msg.attachments?.length ? '(Pièce jointe)' : '');
            existing.lastAt = msg.created_at;
          }
          if (msg.receiver_id === currentUserId && !msg.read) {
            existing.unread += 1;
          }
        }

        const previews: ConversationPreview[] = [];
        for (const [uid, info] of convMap) {
          const infoUser = getUserInfo(uid);
          previews.push({
            userId: uid,
            name: infoUser.name,
            initials: infoUser.initials,
            color: infoUser.color,
            lastMessage: info.lastMessage,
            lastAt: info.lastAt,
            unread: info.unread,
            last_seen: lastSeenMap.get(uid),
          });
        }
        previews.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
        setConversations(previews);

        // Fetch profiles for conversation partners
        const partnerIds = [...convMap.keys()];
        if (partnerIds.length > 0) {
          const profiles = await fetchProfilesMap(partnerIds);
          setProfilesMap(profiles);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [currentUserId, getUserInfo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Mettre à jour last_seen toutes les 30s quand sur la page ---
  useEffect(() => {
    if (!currentUserId) return;
    const updateLastSeen = async () => {
      try {
        await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', currentUserId);
      } catch {
        // ignore
      }
    };
    updateLastSeen();
    const interval = setInterval(updateLastSeen, 30000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  // --- Marquer les messages comme lus (avec read_at) ---
  useEffect(() => {
    async function markRead() {
      if (!activeUserId || !currentUserId) return;
      const unread = messages.filter((m) => m.sender_id === activeUserId && m.receiver_id === currentUserId && !m.read);
      if (unread.length === 0) return;
      const now = new Date().toISOString();
      try {
        await supabase
          .from('messages')
          .update({ read: true, read_at: now })
          .in('id', unread.map((m) => m.id));
        setMessages((prev) => prev.map((m) => (unread.some((u) => u.id === m.id) ? { ...m, read: true, read_at: now } : m)));
        setConversations((prev) => prev.map((c) => (c.userId === activeUserId ? { ...c, unread: 0 } : c)));
      } catch {
        // ignore
      }
    }
    markRead();
  }, [activeUserId, currentUserId, messages]);

  // --- Scroll auto en bas (intelligent : seulement si déjà proche du bas) ---
  useEffect(() => {
    if (bottomRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
      if (isNearBottom) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, activeUserId]);

  // --- Realtime: écouter les nouveaux messages ---
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === currentUserId || newMsg.receiver_id === currentUserId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            const otherId = newMsg.sender_id === currentUserId ? newMsg.receiver_id : newMsg.sender_id;
            setConversations((prev) => {
              const existing = prev.find((c) => c.userId === otherId);
              if (existing) {
                return prev
                  .map((c) =>
                    c.userId === otherId
                      ? {
                          ...c,
                          lastMessage: newMsg.content || (newMsg.attachments?.length ? '(Pièce jointe)' : ''),
                          lastAt: newMsg.created_at,
                          unread: newMsg.receiver_id === currentUserId && !newMsg.read && c.userId !== activeUserId ? c.unread + 1 : c.unread,
                        }
                      : c
                  )
                  .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
              }
              const u = getUserInfo(otherId);
              return [
                {
                  userId: otherId,
                  name: u.name,
                  initials: u.initials,
                  color: u.color,
                  lastMessage: newMsg.content || (newMsg.attachments?.length ? '(Pièce jointe)' : ''),
                  lastAt: newMsg.created_at,
                  unread: newMsg.receiver_id === currentUserId && !newMsg.read ? 1 : 0,
                },
                ...prev,
              ];
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, activeUserId, getUserInfo]);

  // --- Realtime: écouter les updates de read / read_at ---
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel('messages-read-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // --- Realtime: écouter les last_seen des profiles ---
  useEffect(() => {
    const channel = supabase
      .channel('profiles-lastseen')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as { id: string; last_seen?: string };
          setConversations((prev) =>
            prev.map((c) => (c.userId === updated.id ? { ...c, last_seen: updated.last_seen } : c))
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeMessages = activeUserId
    ? messages.filter(
        (m) =>
          (m.sender_id === currentUserId && m.receiver_id === activeUserId) ||
          (m.sender_id === activeUserId && m.receiver_id === currentUserId)
      )
    : [];

  const activeConv = activeUserId ? conversations.find((c) => c.userId === activeUserId) : null;
  const activeUser = activeUserId ? getUserInfo(activeUserId) : null;

  // --- Upload de pièce jointe ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;
    setUploadError(null);

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Fichier trop lourd. Maximum 5 Mo par fichier.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (activeAttachments.length >= 3) {
      setUploadError('Maximum 3 pièces jointes par message.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || '';
      const path = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('message-attachments').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) {
        setUploadError("L'upload a échoué. Vérifiez les droits d'accès au stockage.");
        setUploading(false);
        return;
      }
      const { data } = supabase.storage.from('message-attachments').getPublicUrl(path);
      setActiveAttachments((prev) => [
        ...prev,
        { name: file.name, type: file.type, size: file.size, url: data.publicUrl },
      ]);
    } catch {
      setUploadError("Erreur lors de l'upload du fichier.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setActiveAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Envoyer un message ---
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputValue.trim() && activeAttachments.length === 0) || !activeUserId || !currentUserId) return;
    setSending(true);
    setSendError(null);
    const newMessage: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      receiver_id: activeUserId,
      content: inputValue.trim(),
      created_at: new Date().toISOString(),
      read: false,
      attachments: activeAttachments.length > 0 ? activeAttachments : undefined,
    };
    setMessages((prev) => [...prev, newMessage]);
    setInputValue('');
    setActiveAttachments([]);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: activeUserId,
          content: newMessage.content || null,
          read: false,
          attachments: newMessage.attachments || null,
        })
        .select()
        .single();

      if (error || !data) {
        // Supprimer le message temporaire et restaurer le brouillon
        setMessages((prev) => prev.filter((m) => m.id !== newMessage.id));
        setInputValue(newMessage.content);
        setActiveAttachments(newMessage.attachments || []);
        setSendError("Erreur lors de l'envoi du message");
        return;
      }

      setMessages((prev) => prev.map((m) => (m.id === newMessage.id ? (data as Message) : m)));
      setConversations((prev) => {
        const existing = prev.find((c) => c.userId === activeUserId);
        if (existing) {
          return prev
            .map((c) =>
              c.userId === activeUserId
                ? {
                    ...c,
                    lastMessage: newMessage.content || (newMessage.attachments?.length ? '(Pièce jointe)' : ''),
                    lastAt: newMessage.created_at,
                  }
                : c
            )
            .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
        }
        const u = getUserInfo(activeUserId);
        return [
          {
            userId: activeUserId,
            name: u.name,
            initials: u.initials,
            color: u.color,
            lastMessage: newMessage.content || (newMessage.attachments?.length ? '(Pièce jointe)' : ''),
            lastAt: newMessage.created_at,
            unread: 0,
          },
          ...prev,
        ];
      });
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <MainLayout>
      <div className="h-[calc(100vh-4rem)] -mx-4 lg:-mx-6 -mb-8 flex flex-col">
        {/* Header mobile */}
        <div className="h-14 border-b border-slate-200 bg-white flex items-center px-4 lg:px-6 flex-shrink-0">
          <h1 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ocean-50 flex items-center justify-center text-ocean-600">
              <i className="ri-mail-send-line text-sm"></i>
            </div>
            Messages
            {totalUnread > 0 && (
              <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-red-500 text-white text-[11px] font-bold">
                {totalUnread}
              </span>
            )}
          </h1>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar conversations */}
          <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white flex flex-col overflow-hidden ${activeUserId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50">
                <div className="w-4 h-4 flex items-center justify-center text-slate-400">
                  <i className="ri-search-line text-sm"></i>
                </div>
                <input
                  type="text"
                  placeholder="Rechercher une conversation..."
                  className="bg-transparent text-sm outline-none flex-1 text-slate-700 placeholder:text-slate-400"
                  onChange={(e) => {
                    const q = e.target.value.toLowerCase();
                    if (!q) { loadData(); return; }
                    setConversations((prev) => prev.filter((c) => c.name.toLowerCase().includes(q)));
                  }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading && conversations.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-5 h-5 flex items-center justify-center mx-auto mb-2">
                    <i className="ri-loader-4-line animate-spin text-ocean-500"></i>
                  </div>
                  <p className="text-xs text-slate-400">Chargement...</p>
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-3">
                    <i className="ri-mail-line text-xl"></i>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Aucune conversation</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Commencez à discuter avec un auteur depuis son profil ou une ressource.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {conversations.map((conv) => (
                    <button
                      key={conv.userId}
                      onClick={() => {
                        setActiveUserId(conv.userId);
                        navigate(`/messages/${conv.userId}`, { replace: true });
                      }}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors ${activeUserId === conv.userId ? 'bg-ocean-50/50' : ''}`}
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                          style={{ backgroundColor: conv.color }}
                        >
                          {conv.initials}
                        </div>
                        {isOnline(conv.last_seen) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-800 truncate">{conv.name}</p>
                          <span className="text-[11px] text-slate-400 flex-shrink-0">{timeAgo(conv.lastAt)}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{conv.lastMessage}</p>
                      </div>
                      {conv.unread > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center mt-1">
                          {conv.unread}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className={`flex-1 flex flex-col bg-slate-50/50 overflow-hidden ${activeUserId ? 'flex' : 'hidden md:flex'}`}>
            {activeUserId && activeUser ? (
              <>
                {/* Chat header avec statut en ligne */}
                <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setActiveUserId(null);
                        navigate('/messages', { replace: true });
                      }}
                      className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-600"
                    >
                      <i className="ri-arrow-left-line"></i>
                    </button>
                    <div className="relative">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                        style={{ backgroundColor: activeUser.color }}
                      >
                        {activeUser.initials}
                      </div>
                      {isOnline(activeConv?.last_seen) && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{activeUser.name}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        {isOnline(activeConv?.last_seen) ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                            En ligne
                          </>
                        ) : activeConv?.last_seen ? (
                          <>Vu {timeAgo(activeConv.last_seen)}</>
                        ) : (
                          <>Enseignant · SVT</>
                        )}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/enseignant/${activeUserId}`}
                    className="text-xs font-medium text-ocean-600 hover:text-ocean-700 flex items-center gap-1"
                  >
                    <i className="ri-user-line"></i>
                    Voir le profil
                  </Link>
                </div>

                {/* Messages */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
                  {activeMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-300 mb-3">
                        <i className="ri-chat-3-line text-xl"></i>
                      </div>
                      <p className="text-sm text-slate-500">Aucun message pour le moment</p>
                      <p className="text-xs text-slate-400 mt-1">Envoyez un message pour commencer la conversation.</p>
                    </div>
                  ) : (
                    activeMessages.map((msg) => {
                      const isMe = msg.sender_id === currentUserId;
                      const sender = getUserInfo(msg.sender_id);
                      return (
                        <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {!isMe && (
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0 mb-1"
                              style={{ backgroundColor: sender.color }}
                            >
                              {sender.initials}
                            </div>
                          )}
                          <div className={`max-w-[75%] lg:max-w-[60%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isMe ? 'bg-ocean-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'}`}>
                            {/* Contenu texte */}
                            {msg.content && <p>{msg.content}</p>}

                            {/* Pièces jointes */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className={`mt-2 space-y-2 ${msg.content ? 'pt-2 border-t border-white/20' : ''}`}>
                                {msg.attachments.map((att, idx) => (
                                  <div key={idx}>
                                    {att.type.startsWith('image/') ? (
                                      <button
                                        onClick={() => setLightboxImage(att.url)}
                                        className="block rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                      >
                                        <img
                                          src={att.url}
                                          alt={att.name}
                                          className="max-w-[200px] max-h-[200px] object-cover rounded-lg"
                                        />
                                      </button>
                                    ) : (
                                      <a
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                          isMe
                                            ? 'bg-white/15 hover:bg-white/25 text-white'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                        }`}
                                      >
                                        <div className="w-7 h-7 rounded-md bg-white/20 flex items-center justify-center flex-shrink-0">
                                          <i className="ri-file-pdf-line text-sm"></i>
                                        </div>
                                        <div className="min-w-0">
                                          <p className="truncate">{att.name}</p>
                                          <p className="text-[10px] opacity-70">{formatFileSize(att.size)}</p>
                                        </div>
                                        <i className="ri-download-line ml-auto flex-shrink-0"></i>
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Heure + vu */}
                            <div className={`flex items-center gap-1.5 text-[11px] mt-1 ${isMe ? 'text-ocean-100 justify-end' : 'text-slate-400'}`}>
                              <span>{formatTime(msg.created_at)}</span>
                              {isMe && (
                                <span className="flex items-center gap-0.5" title={msg.read_at ? `Vu à ${formatTime(msg.read_at)}` : 'Envoyé'}>
                                  {msg.read ? (
                                    <>
                                      <i className="ri-check-double-line text-[11px]"></i>
                                      {msg.read_at && <span className="text-[9px] opacity-80">Vu</span>}
                                    </>
                                  ) : (
                                    <i className="ri-check-line text-[11px]"></i>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input avec pièces jointes */}
                <form onSubmit={handleSend} className="p-3 lg:p-4 border-t border-slate-200 bg-white flex-shrink-0">
                  {/* Aperçu des pièces jointes actives */}
                  {activeAttachments.length > 0 && (
                    <div className="flex gap-2 mb-2 flex-wrap">
                      {activeAttachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-xs text-slate-700 border border-slate-200"
                        >
                          {att.type.startsWith('image/') ? (
                            <i className="ri-image-line text-ocean-500"></i>
                          ) : (
                            <i className="ri-file-pdf-line text-red-500"></i>
                          )}
                          <span className="max-w-[120px] truncate">{att.name}</span>
                          <span className="text-slate-400">{formatFileSize(att.size)}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500"
                          >
                            <i className="ri-close-line text-xs"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {uploadError && (
                    <p className="text-xs text-red-500 mb-2">{uploadError}</p>
                  )}
                  {sendError && (
                    <p className="text-xs text-red-500 mb-2">{sendError}</p>
                  )}
                  <div className="flex items-end gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || activeAttachments.length >= 3}
                      className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-500 flex items-center justify-center transition-colors flex-shrink-0"
                      title="Ajouter une pièce jointe (image ou PDF, max 3)"
                    >
                      {uploading ? (
                        <i className="ri-loader-4-line animate-spin text-sm"></i>
                      ) : (
                        <i className="ri-attachment-2 text-sm"></i>
                      )}
                    </button>
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Écrivez un message..."
                      rows={1}
                      className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-transparent max-h-32"
                      style={{ minHeight: '44px' }}
                    />
                    <button
                      type="submit"
                      disabled={sending || (!inputValue.trim() && activeAttachments.length === 0)}
                      className="w-10 h-10 rounded-xl bg-ocean-600 hover:bg-ocean-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0"
                    >
                      <i className="ri-send-plane-fill text-sm"></i>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 ml-12 hidden sm:block">
                    Entrée pour envoyer · Shift+Entrée pour sauter une ligne · Max 3 fichiers (5 Mo chacun)
                  </p>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-300 mb-4">
                  <i className="ri-chat-3-line text-2xl"></i>
                </div>
                <p className="text-sm text-slate-500 font-medium">Sélectionnez une conversation</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Choisissez un contact dans la liste à gauche pour consulter vos messages, ou contactez un enseignant depuis son profil.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox image */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <img src={lightboxImage} alt="Aperçu" className="max-w-full max-h-[90vh] rounded-lg object-contain" />
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>
      )}
    </MainLayout>
  );
}