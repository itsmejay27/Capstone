/**
 * Slug <-> index mapping for the ClassroomDetail tab strip.
 *
 * The tabs are a plain MUI <Tabs value={number}>, so the index is the source of truth in the
 * component. Putting a slug in the URL (`/classroom/:id?tab=gradebook`) is what lets the
 * hamburger drawer deep-link straight to Course Materials / People & Roster / Gradebook,
 * and makes a tab bookmarkable and reachable with the browser back button.
 *
 * The wrinkle this module exists to contain: the Gradebook tab is rendered ONLY for
 * instructors, so index 3 exists for an instructor and does not exist for a student. Every
 * conversion is therefore role-aware and clamps rather than returning an out-of-range index.
 */

export type ClassroomTabSlug = 'stream' | 'classwork' | 'assessments' | 'materials' | 'people' | 'gradebook';

/** Ordered to match the <Tab> children in ClassroomDetail. */
export const CLASSROOM_TAB_SLUGS: ClassroomTabSlug[] = [
  'stream', 'classwork', 'assessments', 'materials', 'people', 'gradebook',
];

/** Instructor-only tabs. A student asking for one of these is sent to the first tab. */
const INSTRUCTOR_ONLY: ReadonlySet<ClassroomTabSlug> = new Set<ClassroomTabSlug>(['gradebook']);

/** Human labels, kept next to the slugs so the drawer and the tab strip cannot drift apart. */
export const CLASSROOM_TAB_LABELS: Record<ClassroomTabSlug, string> = {
  stream: 'Stream',
  classwork: 'Classwork',
  assessments: 'Assessments',
  materials: 'Course Materials',
  people: 'People & Roster',
  gradebook: 'Gradebook',
};

export function isClassroomTabSlug(value: unknown): value is ClassroomTabSlug {
  return typeof value === 'string' && (CLASSROOM_TAB_SLUGS as string[]).includes(value);
}

/** Tabs this role can actually see, in render order. */
export function visibleTabSlugs(isInstructor: boolean): ClassroomTabSlug[] {
  return CLASSROOM_TAB_SLUGS.filter((slug) => isInstructor || !INSTRUCTOR_ONLY.has(slug));
}

/**
 * Resolve a URL slug to a tab index for the given role.
 * Unknown, absent, or role-forbidden slugs clamp to 0 rather than producing an index that
 * renders no panel at all.
 */
export function tabSlugToIndex(slug: string | null | undefined, isInstructor: boolean): number {
  if (!isClassroomTabSlug(slug)) return 0;
  if (!isInstructor && INSTRUCTOR_ONLY.has(slug)) return 0;
  const idx = visibleTabSlugs(isInstructor).indexOf(slug);
  return idx < 0 ? 0 : idx;
}

/** Inverse of tabSlugToIndex. Out-of-range indices clamp to the first tab. */
export function tabIndexToSlug(index: number, isInstructor: boolean): ClassroomTabSlug {
  const visible = visibleTabSlugs(isInstructor);
  if (!Number.isInteger(index) || index < 0 || index >= visible.length) return visible[0];
  return visible[index];
}
