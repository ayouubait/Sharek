export interface Teacher {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  cover: string | null;
  initials: string;
  institution: string;
  city: string;
  specialty: string;
  level: string;
  bio: string;
  resources_count: number;
  reviews_count: number;
  contribution_score: number;
  role: string;
  color: string;
}

export interface ResourceVersion {
  id: string;
  resource_id: string;
  version_number: number;
  file_url: string;
  file_type: string;
  notes: string;
  created_by: string;
  created_at: string;
  status: string;
  round: number;
}

export interface Resource {
  id: string;
  title: string;
  school_level: string;
  unit: string;
  type: string;
  type_label: string;
  file_url: string;
  file_type: string;
  cover_image_url?: string | null;
  youtube_url?: string | null;
  embed_url?: string | null;
  embed_title?: string | null;
  objectives: string;
  competencies: string;
  duration: string;
  keywords: string[];
  status: string;
  status_label: string;
  author_id: string;
  created_at: string;
  views: number;
  downloads: number;
  comments_count: number;
  current_version?: number;
  version_count?: number;
  subject?: string;
}

export interface Comment {
  id: string;
  resource_id: string;
  author_id: string;
  type: string;
  type_label: string;
  content: string;
  created_at: string;
  likes_count?: number;
}

export interface PeerReview {
  id: string;
  resource_id: string;
  reviewer_id: string;
  status: string;
  status_label: string;
  joined_at: string;
  recommendation_submitted: boolean;
}

export interface Recommendation {
  id: string;
  resource_id: string;
  reviewer_id: string;
  reviewer_name: string;
  file_name: string;
  submitted_at: string;
  status: string;
  status_label: string;
  observations: string;
  strengths: string;
  weaknesses: string;
  suggestions: string;
  decision: string;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  time: string;
  read: boolean;
}

export interface NotificationItem {
  id: string;
  type: string;
  title?: string;
  message: string;
  time: string;
  read: boolean;
  resource_id?: string;
  created_at?: string;
}

export interface ReviewProgressStep {
  step: string;
  completed: boolean;
  icon: string;
}

export interface FormItem {
  id: string;
  title: string;
  description: string;
  type: string;
  type_label: string;
  school_level: string;
  subject_unit: string;
  pages: number;
  questions_count: number;
  duration: string;
  author_id: string;
  created_at: string;
  downloads: number;
  views: number;
  keywords: string[];
  file_url: string;
}