-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "platform" TEXT,
    "environment" TEXT,
    "release" TEXT,
    "name" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT,
    "properties" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorGroup" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "top_stack" TEXT,
    "app" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorOccurrence" (
    "id" TEXT NOT NULL,
    "error_group_id" TEXT NOT NULL,
    "stack" TEXT,
    "context" JSONB,
    "session_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "platform" TEXT,
    "user_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErrorGroup_fingerprint_key" ON "ErrorGroup"("fingerprint");

-- AddForeignKey
ALTER TABLE "ErrorOccurrence" ADD CONSTRAINT "ErrorOccurrence_error_group_id_fkey" FOREIGN KEY ("error_group_id") REFERENCES "ErrorGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
