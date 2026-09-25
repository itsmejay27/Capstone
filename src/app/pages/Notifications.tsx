import { teachesClass } from '../services/classAccess';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Box, Paper, Typography, Button, Chip, Avatar, Stack, LinearProgress,
  IconButton, Tooltip, Divider,
} from '@mui/material';
import {
  AssignmentTurnedIn, ErrorOutline, Schedule, TaskAlt, RateReview, Campaign,
  ArrowForward, NotificationsNone, EventBusy, Bolt, Inbox, ChatBubbleOutline, Lock,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import {
  PageContainer, PageHeader, SectionHeading, FilterBar, FilterPill,
  EmptyState, StatusPill,
} from '../components/ui-kit';
import { palette, radius, font, tintFor, shadow } from '../theme/tokens';
import {
  buildStudentTodo, buildInstructorTodo, dueLabel, isOverdue,
  type TodoItem, type TodoBucket,
} from '../services/todo';
import { useIsMobile } from '../hooks/useResponsive';
import { commentActivityFor, getCommentsSeenAt, markCommentsSeen } from '../services/commentActivity';

/**
 * To-do / Notifications.
 *
 * Google Classroom's "Assigned / Missing / Done" for students and "To review" for
 * instructors, plus the class announcement stream rolled into one inbox. Everything is
 * derived by src/app/services/todo.ts from the real exams, classwork and attempts, so this
 * page can never disagree with the class pages.
 */

type ViewFilter = 'all' | TodoBucket;

const BUCKET_META: Record<TodoBucket, { label: string; tone: 'danger' | 'info' | 'success' | 'warning'; icon: any }> = {
  missing: { label: 'Missing', tone: 'danger', icon: ErrorOutline },
  assigned: { label: 'Assigned', tone: 'info', icon: Schedule },
  done: { label: 'Done', tone: 'success', icon: TaskAlt },
  review: { label: 'To review', tone: 'warning', icon: RateReview },
};

/** Large summary tile with a coloured rail — the visual anchor of the page. */
function SummaryTile({
  label, value, tone, icon: Icon, active, onClick,
}: {
  label: string; value: number;
  tone: 'danger' | 'info' | 'success' | 'warning' | 'neutral';
  icon: any; active?: boolean; onClick?: () => void;
}) {
  const map = {
    danger: { fg: palette.danger, bg: palette.dangerSoft },
    info: { fg: palette.info, bg: palette.infoSoft },
    success: { fg: palette.success, bg: palette.successSoft },
    warning: { fg: palette.warning, bg: palette.warningSoft },
    neutral: { fg: palette.inkSecondary, bg: palette.surfaceSunken },
  }[tone];

  return (
    <Paper
      onClick={onClick}
      sx={{
        position: 'relative', overflow: 'hidden', flex: '1 1 150px', minWidth: 0,
        p: 2, pl: 2.5, borderRadius: '14px', cursor: onClick ? 'pointer' : 'default',
        border: `1px solid ${active ? map.fg : palette.border}`,
        bgcolor: active ? map.bg : palette.surface,
        transition: 'border-color .15s ease, background-color .15s ease, transform .15s ease',
        '&:hover': onClick ? { transform: 'translateY(-2px)', boxShadow: shadow.md } : undefined,
      }}
    >
      {/* Coloured rail */}
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: map.fg }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
        <Box
          sx={{
            width: 26, height: 26, borderRadius: '8px', bgcolor: map.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 16, color: map.fg }} />
        </Box>
        <Typography variant="caption" sx={{ color: palette.inkSecondary, fontWeight: 700 }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: map.fg, lineHeight: 1 }}>
        {value}
      </Typography>
    </Paper>
  );
}

function TodoRow({ item, onOpen }: { item: TodoItem; onOpen: () => void }) {
  const meta = BUCKET_META[item.bucket];
  const Icon = meta.icon;
  const tint = tintFor(item.classroomId);
  const overdue = item.bucket === 'missing';

  return (
    <Paper
      onClick={onOpen}
      sx={{
        p: { xs: 1.75, sm: 2 }, mb: 1.25, borderRadius: '14px', cursor: 'pointer',
        border: `1px solid ${overdue ? palette.dangerSoft : palette.border}`,
        borderLeft: `3px solid ${overdue ? palette.danger : tint.from}`,
        display: 'flex', alignItems: 'center', gap: 1.75,
        transition: 'transform .12s ease, box-shadow .12s ease',
        '&:hover': { transform: 'translateX(2px)', boxShadow: shadow.sm },
      }}
    >
      <Box
        sx={{
          width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
          background: `linear-gradient(135deg, ${tint.from}, ${tint.to})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {item.kind === 'exam'
          ? <Bolt sx={{ fontSize: 18, color: tint.ink }} />
          : <AssignmentTurnedIn sx={{ fontSize: 18, color: tint.ink }} />}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{ fontFamily: font.mono, fontSize: '0.88rem', fontWeight: 600, color: palette.ink }}
          noWrap
          title={item.title}
        >
          {item.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.35, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ color: palette.inkSecondary, fontWeight: 600 }} noWrap>
            {item.className}
          </Typography>
          <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: palette.inkDisabled }} />
          <Typography
            variant="caption"
            sx={{ color: overdue ? palette.danger : palette.inkTertiary, fontWeight: overdue ? 700 : 500 }}
          >
            {dueLabel(item.dueDate)}
          </Typography>
          {item.totalPoints ? (
            <>
              <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: palette.inkDisabled }} />
              <Typography variant="caption" sx={{ color: palette.inkTertiary }}>
                {item.totalPoints} pts
              </Typography>
            </>
          ) : null}
        </Box>
      </Box>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
        {item.pendingCount !== undefined && item.pendingCount > 0 && (
          <Chip
            label={`${item.pendingCount} to grade`}
            size="small"
            sx={{ bgcolor: palette.warningSoft, color: palette.warning, fontWeight: 700 }}
          />
        )}
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <StatusPill label={meta.label} tone={meta.tone} />
        </Box>
        <ArrowForward sx={{ fontSize: 16, color: palette.inkDisabled }} />
      </Stack>
    </Paper>
  );
}

export default function Notifications() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    currentUser, classrooms, exams, examAttempts,
    classwork, submissions, announcements, comments,
  } = useAuth();

  const [filter, setFilter] = useState<ViewFilter>('all');
  const isInstructor = currentUser?.role === 'instructor';

  // Context stores classwork grouped by classroom; the to-do builder wants one flat list.
  const flatClasswork = useMemo(
    () => Object.values(classwork || {}).flat(),
    [classwork]
  );

  const todos = useMemo(() => {
    if (!currentUser) return [];
    return isInstructor
      ? buildInstructorTodo(currentUser.id, classrooms, exams, flatClasswork, examAttempts, submissions)
      : buildStudentTodo(currentUser.id, classrooms, exams, flatClasswork, examAttempts, submissions);
  }, [currentUser, isInstructor, classrooms, exams, flatClasswork, examAttempts, submissions]);

  const counts = useMemo(() => {
    const c = { missing: 0, assigned: 0, done: 0, review: 0 };
    // "To review" counts submissions waiting to be graded, the same number the dashboard shows.
    todos.forEach((t) => { c[t.bucket] += t.bucket === 'review' ? (t.pendingCount || 1) : 1; });
    return c;
  }, [todos]);

  // Finished items drop off the list; they are still counted in the Done tile.
  const visible = filter === 'all' ? todos.filter((t) => t.bucket !== 'done') : todos.filter((t) => t.bucket === filter);

  /** Recent announcements across the user's classes, newest first. */
  const recentAnnouncements = useMemo(() => {
    const myClassIds = new Set(
      classrooms
        .filter((c: any) =>
          isInstructor ? teachesClass(c, currentUser?.id) : c.students?.includes(currentUser?.id)
        )
        .map((c: any) => c.id)
    );
    return Object.entries(announcements || {})
      .filter(([cid]) => myClassIds.has(cid))
      .flatMap(([cid, list]: [string, any]) =>
        (list || []).map((a: any) => ({
          ...a,
          className: classrooms.find((c: any) => c.id === cid)?.name || 'Class',
        }))
      )
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [announcements, classrooms, currentUser, isInstructor]);

  const [clearedAt, setClearedAt] = useState(() => {
    try { return Number(localStorage.getItem(`notificationsClearedAt:${currentUser?.id}`) || 0); } catch { return 0; }
  });
  const clearAll = () => {
    const now = Date.now();
    try { localStorage.setItem(`notificationsClearedAt:${currentUser?.id}`, String(now)); } catch { /* storage blocked */ }
    setClearedAt(now);
    markCommentsSeen(currentUser?.id);
  };
  const [annClearedAt, setAnnClearedAt] = useState(() => {
    try { return Number(localStorage.getItem(`announcementsClearedAt:${currentUser?.id}`) || 0); } catch { return 0; }
  });
  const clearAnnouncements = () => {
    const now = Date.now();
    try { localStorage.setItem(`announcementsClearedAt:${currentUser?.id}`, String(now)); } catch { /* storage blocked */ }
    setAnnClearedAt(now);
  };
  const shownAnnouncements = recentAnnouncements.filter((a: any) => new Date(a.createdAt).getTime() > annClearedAt);
  const commentActivity = useMemo(
    () => commentActivityFor(currentUser, classrooms, comments)
      .filter((c) => new Date(c.createdAt).getTime() > clearedAt)
      .slice(0, 15),
    [currentUser, classrooms, comments, clearedAt]
  );
  // Snapshot the previous "seen" time so new items stay highlighted during this visit,
  // then mark everything seen so the sidebar badge clears.
  const [seenBefore] = useState(() => getCommentsSeenAt(currentUser?.id));
  useEffect(() => {
    markCommentsSeen(currentUser?.id);
  }, [currentUser?.id, comments.length]);

  const activeCount = counts.missing + counts.assigned + counts.review;
  const doneRatio = todos.length > 0 ? counts.done / todos.length : 0;

  return (
    <PageContainer>
      <PageHeader
        title={isInstructor ? 'To review' : 'To-do'}
        subtitle={
          isInstructor
            ? 'Submissions waiting on you, across every class you teach.'
            : activeCount === 0
              ? 'Nothing outstanding — you are all caught up.'
              : `${activeCount} item${activeCount === 1 ? '' : 's'} need your attention.`
        }
      />

      {/* Summary tiles double as filters */}
      <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap', mb: 2.5 }}>
        {isInstructor ? (
          <>
            <SummaryTile
              label="To review" value={counts.review} tone="warning" icon={RateReview}
              active={filter === 'review'} onClick={() => setFilter(filter === 'review' ? 'all' : 'review')}
            />
            <SummaryTile label="Classes" value={classrooms.filter((c: any) => teachesClass(c, currentUser?.id)).length} tone="info" icon={Inbox} />
            <SummaryTile
              label="Submissions" value={submissions.filter((s: any) => s.submittedAt).length + examAttempts.filter((a: any) => a.submittedAt).length}
              tone="success" icon={TaskAlt}
            />
          </>
        ) : (
          <>
            <SummaryTile
              label="Missing" value={counts.missing} tone="danger" icon={ErrorOutline}
              active={filter === 'missing'} onClick={() => setFilter(filter === 'missing' ? 'all' : 'missing')}
            />
            <SummaryTile
              label="Assigned" value={counts.assigned} tone="info" icon={Schedule}
              active={filter === 'assigned'} onClick={() => setFilter(filter === 'assigned' ? 'all' : 'assigned')}
            />
            <SummaryTile
              label="Done" value={counts.done} tone="success" icon={TaskAlt}
              active={filter === 'done'} onClick={() => setFilter(filter === 'done' ? 'all' : 'done')}
            />
          </>
        )}
      </Stack>

      {/* Progress ribbon — students only; instructors have no "completion" of their own. */}
      {!isInstructor && todos.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: '14px', border: `1px solid ${palette.border}` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: palette.inkSecondary }}>
              Term progress
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 800, color: palette.ink }}>
              {counts.done} of {todos.length} complete
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={doneRatio * 100}
            sx={{ height: 8, '& .MuiLinearProgress-bar': { bgcolor: palette.success } }}
          />
        </Paper>
      )}

      <FilterBar>
        <FilterPill<ViewFilter>
          label="Show"
          value={filter}
          onChange={setFilter}
          options={
            isInstructor
              ? [{ value: 'all', label: 'Everything' }, { value: 'review', label: 'To review' }]
              : [
                  { value: 'all', label: 'Everything' },
                  { value: 'missing', label: 'Missing' },
                  { value: 'assigned', label: 'Assigned' },
                  { value: 'done', label: 'Done' },
                ]
          }
        />
      </FilterBar>

      <SectionHeading title={isInstructor ? 'Needs grading' : 'Your work'} count={visible.length} />

      {visible.length === 0 ? (
        <EmptyState
          icon={filter === 'missing' ? <EventBusy /> : <NotificationsNone />}
          title={
            filter === 'missing' ? 'Nothing missing'
              : filter === 'done' ? 'Nothing completed yet'
                : isInstructor ? 'No submissions waiting'
                  : 'You are all caught up'
          }
          description={
            isInstructor
              ? 'When students turn work in, it will appear here for grading.'
              : 'New exams and assignments from your classes will show up here.'
          }
          action={
            <Button variant="outlined" onClick={() => navigate('/dashboard')}>
              Go to my classes
            </Button>
          }
        />
      ) : (
        <Box sx={{ mb: 4 }}>
          {visible.map((item) => (
            <TodoRow key={`${item.kind}-${item.id}`} item={item} onOpen={() => navigate(item.href)} />
          ))}
        </Box>
      )}

      {/* Recent comments */}
      {commentActivity.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />
          <SectionHeading title="Recent comments" count={commentActivity.length}
            action={<Button size="small" onClick={clearAll} sx={{ textTransform: 'none', fontWeight: 600 }}>Clear all</Button>} />
          <Box>
            {commentActivity.map((c) => {
              const tint = tintFor(c.classroomId);
              const isNew = new Date(c.createdAt).getTime() > seenBefore;
              return (
                <Paper
                  key={c.id}
                  onClick={() => navigate(c.href)}
                  sx={{
                    p: 2, mb: 1.25, borderRadius: '14px', cursor: 'pointer',
                    border: `1px solid ${isNew ? palette.primary : palette.border}`,
                    display: 'flex', gap: 1.75, alignItems: 'flex-start',
                    '&:hover': { boxShadow: shadow.sm },
                  }}
                >
                  <Avatar sx={{ width: 34, height: 34, bgcolor: tint.from, color: tint.ink, flexShrink: 0 }}>
                    {c.isPrivate ? <Lock sx={{ fontSize: 16 }} /> : <ChatBubbleOutline sx={{ fontSize: 16 }} />}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: palette.ink }}>
                        {c.authorName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: palette.inkSecondary }}>
                        {c.isPrivate ? 'sent a private comment' : `commented on ${c.postType === 'announcement' ? 'an announcement' : 'classwork'}`}
                      </Typography>
                      <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: palette.inkDisabled }} />
                      <Typography variant="caption" sx={{ color: palette.inkSecondary }}>
                        {c.className}
                      </Typography>
                      {isNew && <StatusPill label="New" tone="info" />}
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        color: palette.inkSecondary, mt: 0.35,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {c.body}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </>
      )}

      {/* Recent announcements */}
      {shownAnnouncements.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />
          <SectionHeading title="Recent announcements" count={shownAnnouncements.length}
            action={<Button size="small" onClick={clearAnnouncements} sx={{ textTransform: 'none', fontWeight: 600 }}>Clear all</Button>} />
          <Box>
            {shownAnnouncements.map((a: any) => {
              const tint = tintFor(a.classroomId);
              return (
                <Paper
                  key={a.id}
                  onClick={() => navigate(`/classroom/${a.classroomId}?tab=stream`)}
                  sx={{
                    p: 2, mb: 1.25, borderRadius: '14px', cursor: 'pointer',
                    border: `1px solid ${palette.border}`,
                    display: 'flex', gap: 1.75, alignItems: 'flex-start',
                    '&:hover': { boxShadow: shadow.sm },
                  }}
                >
                  <Avatar sx={{ width: 34, height: 34, bgcolor: tint.from, color: tint.ink, flexShrink: 0 }}>
                    <Campaign sx={{ fontSize: 17 }} />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: palette.ink }}>
                        {a.authorName}
                      </Typography>
                      <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: palette.inkDisabled }} />
                      <Typography variant="caption" sx={{ color: palette.inkSecondary }}>
                        {a.className}
                      </Typography>
                      {a.isPinned && <StatusPill label="Pinned" tone="warning" />}
                    </Box>
                    {/* Announcement bodies are sanitized HTML; the inbox shows a plain-text
                        preview rather than rendering markup in a list row. */}
                    <Typography
                      variant="body2"
                      sx={{
                        color: palette.inkSecondary, mt: 0.35,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {String(a.bodyHtml || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </>
      )}
    </PageContainer>
  );
}
