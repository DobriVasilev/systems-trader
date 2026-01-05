/*
  Warnings:

  - You are about to drop the column `title` on the `PatternSession` table. All the data in the column will be lost.
  - You are about to drop the column `canEdit` on the `SessionShare` table. All the data in the column will be lost.
  - Added the required column `name` to the `PatternSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PatternSession" DROP COLUMN "title",
ADD COLUMN     "name" TEXT NOT NULL,
ALTER COLUMN "startTime" DROP NOT NULL,
ALTER COLUMN "endTime" DROP NOT NULL,
ALTER COLUMN "patternVersion" SET DEFAULT '1.0.0',
ALTER COLUMN "status" SET DEFAULT 'draft';

-- AlterTable
ALTER TABLE "SessionShare" DROP COLUMN "canEdit",
ADD COLUMN     "permission" TEXT NOT NULL DEFAULT 'view';
