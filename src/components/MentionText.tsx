import { Link } from 'react-router-dom';

interface MentionUser {
  id: string;
  name: string;
}

interface MentionTextProps {
  text: string;
  className?: string;
  users?: MentionUser[];
}

// Simple mention parser: detects @Name or @Name Surname and renders as links
export default function MentionText({ text, className = '', users }: MentionTextProps) {
  const mentionRegex = /(@[A-Za-zÀ-ÿ\-]+(?:\s+[A-Za-zÀ-ÿ\-]+)*)/g;
  const parts = text.split(mentionRegex);

  function findUser(name: string): MentionUser | undefined {
    const normalized = name.toLowerCase().trim();
    if (users) {
      const fromUsers = users.find((u) => u.name.toLowerCase().trim() === normalized);
      if (fromUsers) return fromUsers;
    }
    return undefined;
  }

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const name = part.slice(1).trim();
          const matchedUser = findUser(name);
          if (matchedUser) {
            return (
              <Link
                key={i}
                to={`/enseignant/${matchedUser.id}`}
                className="font-medium text-sharek-600 hover:text-sharek-700 hover:underline cursor-pointer"
                title={`Voir le profil de ${name}`}
              >
                {part}
              </Link>
            );
          }
          return (
            <span key={i} className="font-medium text-sharek-600">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}