# Access model

Version: 2.0
Priority: HIGH

## Authenticated access and teacher attendance scope

The system keeps one shared access level for general application modules. A
user linked to a teacher profile receives additional server-enforced scope for
attendance: only classes/subjects assigned to that teacher can be viewed or
changed.
There is no role-management screen.

| Actor | Access |
|---|---|
| Authenticated user without teacher link | All application modules and actions |
| User linked to a teacher | Attendance only for that teacher's assigned classes/subjects |
| Unauthenticated user | Public pages only; protected pages and APIs require login |

## Enforcement

Page and API access only verify authentication:

- `requireAuth()` for protected pages
- `requireApiUser()` for protected API handlers
- `middleware.ts` for the global protected-route boundary

Teacher linked accounts are redirected away from `/admin`; non-attendance APIs
deny them. Attendance APIs verify `user.teacherId` against the class-subject
teacher assignment for class lists, new sessions, and saved sessions.

The UI shows the teacher attendance navigation to linked teacher accounts and
the administration navigation to other authenticated accounts.

Business validations remain active independently of authentication, including
financial consistency checks, audit requirements, and non-hard-delete rules.

## Removed concepts

The application no longer uses `ADMIN`, `STAFF`, or `TEACHER` as authorization
roles. Existing users remain users, but role assignment and role-based UI/API
checks are not supported.
