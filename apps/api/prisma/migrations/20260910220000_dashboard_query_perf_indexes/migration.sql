-- Dashboard summary query performance (overview, releases, sessions).
-- CREATE INDEX (not CONCURRENTLY): Prisma migrate deploy runs inside a transaction.

-- GET /api/overview top events, GET /api/performance/summary ($web_vital / $request),
-- GET /api/overview request metrics, fetchLatestEventsByName DISTINCT ON (name).
-- Not redundant with Event_project_id_created_at_idx (name is not in that key).
CREATE INDEX IF NOT EXISTS "Event_project_id_name_created_at_idx"
ON "Event"("project_id", "name", "created_at" DESC);

-- Session list/summary LATERAL event_count / last_event_at, and
-- sessionEffectiveReleaseKeySql correlated latest-event lookup
-- (project_id, session_id, app, ORDER BY created_at DESC LIMIT 1).
-- Not redundant with Event_project_id_created_at_idx or Event_project_id_app_idx
-- (session_id is not in those keys).
CREATE INDEX IF NOT EXISTS "Event_project_id_session_id_app_created_at_idx"
ON "Event"("project_id", "session_id", "app", "created_at" DESC);

-- Prisma Event.release equality + time windows. Not redundant with
-- Event_project_id_created_at_idx (release is not in that key).
CREATE INDEX IF NOT EXISTS "Event_project_id_release_created_at_idx"
ON "Event"("project_id", "release", "created_at");

-- GET /api/releases/summary Event GROUP BY normalizeReleaseKeySql(e.release)
-- (TRIM / blank / __unknown__). A btree on the raw release column cannot serve
-- TRIM(release) or the CASE expression.
CREATE INDEX IF NOT EXISTS "Event_project_id_release_key_created_at_idx"
ON "Event" (
  "project_id",
  (
    CASE
      WHEN "release" IS NULL
        OR TRIM("release") = ''
        OR TRIM("release") = '__unknown__'
      THEN NULL
      ELSE TRIM("release")
    END
  ),
  "created_at"
);

-- GET /api/releases/summary Session GROUP BY TRIM(release) when Session.release
-- is already known (COALESCE short-circuits before the Event fallback).
-- Not redundant with Session_project_id_release_idx (no started_at; no TRIM).
CREATE INDEX IF NOT EXISTS "Session_project_id_release_key_started_at_idx"
ON "Session" (
  "project_id",
  (
    CASE
      WHEN "release" IS NULL
        OR TRIM("release") = ''
        OR TRIM("release") = '__unknown__'
      THEN NULL
      ELSE TRIM("release")
    END
  ),
  "started_at"
);

-- Crash-free session NOT EXISTS / session list status:
-- ErrorOccurrence.session_id = Session.session_id AND ErrorGroup.project_id.
-- Existing ErrorOccurrence indexes are all prefixed by error_group_id.
CREATE INDEX IF NOT EXISTS "ErrorOccurrence_session_id_idx"
ON "ErrorOccurrence"("session_id");

-- Sessions cohort first-seen and user-device link expansion by user_id.
-- Not redundant with Session_project_id_started_at_idx (user_id is not in that key).
CREATE INDEX IF NOT EXISTS "Session_project_id_user_id_started_at_idx"
ON "Session"("project_id", "user_id", "started_at");

-- Sessions cohort first-seen and user-device link expansion by anonymous_id.
-- Not redundant with Session_project_id_started_at_idx or the user_id index.
CREATE INDEX IF NOT EXISTS "Session_project_id_anonymous_id_started_at_idx"
ON "Session"("project_id", "anonymous_id", "started_at");
