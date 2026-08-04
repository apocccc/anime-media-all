-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "derivedFromId" TEXT;

-- AlterTable
ALTER TABLE "RssFeed" ADD COLUMN     "isPressRelease" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_derivedFromId_fkey" FOREIGN KEY ("derivedFromId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
