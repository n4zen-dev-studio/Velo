-- DropForeignKey
ALTER TABLE "sync_device_state" DROP CONSTRAINT "sync_device_state_user_id_fkey";

-- AlterTable
ALTER TABLE "sync_device_state" ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "sync_device_state" ADD CONSTRAINT "sync_device_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
