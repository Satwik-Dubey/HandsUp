import type { StudentNamespace } from "./student";
import type { TeacherNamespace } from "./teacher";

/** Room name for one session, used in both namespaces. */
export const sessionRoom = (sid: string) => `sess:${sid}`;

/** The two namespaces, set once at startup so feature modules can broadcast. */
export const hub = {} as { students: StudentNamespace; teachers: TeacherNamespace };
