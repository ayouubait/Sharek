import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import AvatarImage from './AvatarImage';

export interface MentionUser {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatar_url: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  users: MentionUser[];
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  className?: string;
}

export default function MentionInput({
  value,
  onChange,
  users,
  placeholder,
  maxLength = 500,
  rows = 3,
  className = '',
}: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  const filteredUsers = useMemo(() => {
    if (!mentionQuery.trim()) return users.slice(0, 6);
    const q = mentionQuery.toLowerCase();
    return users
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [users, mentionQuery]);

  const detectMention = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    setCursorPosition(pos);

    const textBeforeCursor = value.slice(0, pos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) {
      setMentionActive(false);
      return;
    }

    // Ignore email patterns (alphanumeric before @)
    const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
    if (charBeforeAt && /[A-Za-z0-9.]/.test(charBeforeAt)) {
      setMentionActive(false);
      return;
    }

    const query = textBeforeCursor.slice(lastAtIndex + 1);
    // If there's a newline or double space after @, cancel mention
    if (/\n{2,}/.test(query) || query.startsWith('  ')) {
      setMentionActive(false);
      return;
    }

    setMentionQuery(query);
    setMentionStartIndex(lastAtIndex);
    setMentionActive(true);
    setSelectedIndex(0);
  }, [value]);

  const insertMention = useCallback(
    (user: MentionUser) => {
      if (mentionStartIndex === -1) return;
      const before = value.slice(0, mentionStartIndex);
      const after = value.slice(cursorPosition);
      const newValue = `${before}@${user.name} ${after}`;
      onChange(newValue);
      setMentionActive(false);
      setMentionQuery('');
      setTimeout(() => {
        if (textareaRef.current) {
          const newPos = mentionStartIndex + user.name.length + 2; // +2 for @ and space
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    },
    [value, mentionStartIndex, cursorPosition, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionActive) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredUsers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredUsers.length > 0) {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMentionActive(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      onChange(newValue);
    }
    // Detect mention after state update
    setTimeout(detectMention, 0);
  };

  const handleClick = () => {
    detectMention();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setMentionActive(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected index when filtered users change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredUsers.length]);

  return (
    <div ref={containerRef} className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onSelect={detectMention}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className={`w-full px-3.5 py-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-200 focus:border-ocean-300 resize-none ${className}`}
      />

      {mentionActive && filteredUsers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden"
        >
          <div className="py-1.5 max-h-60 overflow-y-auto">
            {filteredUsers.map((user, idx) => (
              <button
                key={user.id}
                type="button"
                onClick={() => insertMention(user)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  idx === selectedIndex
                    ? 'bg-sharek-50'
                    : 'hover:bg-slate-50'
                }`}
              >
                <AvatarImage
                  src={user.avatar_url}
                  initials={user.initials}
                  color={user.color}
                  className="w-7 h-7"
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      idx === selectedIndex
                        ? 'text-sharek-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {user.name}
                  </p>
                </div>
                {idx === selectedIndex && (
                  <div className="w-4 h-4 flex items-center justify-center text-sharek-500">
                    <i className="ri-corner-down-left-line text-xs"></i>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {mentionActive && mentionQuery && filteredUsers.length === 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-card p-3 text-sm text-slate-400">
          Aucun collègue trouvé
        </div>
      )}
    </div>
  );
}

/**
 * Extract @mentions from a text and return the mentioned user names
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@([A-Za-zÀ-ÿ\-\s]+?)(?=\s{2,}|\n{2,}|\s@|[^A-Za-zÀ-ÿ\-\s]|$)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const name = match[1].trim();
    if (name.length > 1) mentions.push(name);
  }
  return [...new Set(mentions)];
}