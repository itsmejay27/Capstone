import { teachesClass } from './classAccess';
/**
 * Comment activity for the notifications inbox and the sidebar badge.
 *
 * An instructor hears about every comment other people leave in the classes they teach.
 * A student hears about comments from others on posts in their classes, excluding other
 * students' private threads (private comments are only between one student and the
 * instructor). Nobody is notified about their own comments.
 */

const SEEN_KEY = (userId: string) => `commentsSeenAt:${userId}`;

export interface CommentActivity {
  id: string;
  classroomId: string;
  className: string;
  postType: 'announcement' | 'classwork';
  authorName: string;
  body: string;
  isPrivate: boolean;
  createdAt: string;
  href: string;
}

export function commentActivityFor(
  user: { id: string; role: string } | null | undefined,
  classrooms: any[],
  comments: any[]
): CommentActivity[] {
  if (!user) return [];
  const isInstructor = user.role === 'instructor';
  const mine = new Map<string, any>(
    (classrooms || [])
      .filter((c: any) => (isInstructor ? teachesClass(c, user.id) : (c.students || []).includes(user.id)))
      .map((c: any) => [c.id, c])
  );

  return (comments || [])
    .filter((c: any) => {
      if (!mine.has(c.classroomId) || c.authorId === user.id) return false;
      if (c.visibility === 'private' && !isInstructor) return c.privateWithId === user.id;
      return true;
    })
    .map((c: any) => ({
      id: c.id,
      classroomId: c.classroomId,
      className: mine.get(c.classroomId)?.name || 'Class',
      postType: c.postType,
      authorName: c.authorName || 'Someone',
      body: String(c.body || ''),
      isPrivate: c.visibility === 'private',
      createdAt: c.createdAt,
      href: `/classroom/${c.classroomId}?tab=${c.postType === 'announcement' ? 'stream' : 'classwork'}`,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getCommentsSeenAt(userId?: string | null): number {
  if (!userId) return 0;
  try {
    return Number(localStorage.getItem(SEEN_KEY(userId)) || 0);
  } catch {
    return 0;
  }
}

export function markCommentsSeen(userId?: string | null): void {
  if (!userId) return;
  try {
    localStorage.setItem(SEEN_KEY(userId), String(Date.now()));
    window.dispatchEvent(new Event('comments-seen'));
  } catch {
    // Storage unavailable: the badge simply stays until next visit.
  }
}

export function unreadCount(activity: CommentActivity[], seenAt: number): number {
  return activity.filter((a) => new Date(a.createdAt).getTime() > seenAt).length;
}
