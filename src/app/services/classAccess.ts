/** True for the class owner and for instructors the owner invited to co-teach. */
export function teachesClass(classroom: any, userId?: string | null): boolean {
  if (!classroom || !userId) return false;
  return classroom.instructorId === userId || (classroom.coInstructors || []).includes(userId);
}
