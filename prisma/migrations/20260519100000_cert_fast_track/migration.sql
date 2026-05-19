-- AlterEnum: thêm FAST_TRACK vào ReviewMode.
-- PostgreSQL gotcha: ALTER TYPE ... ADD VALUE phải chạy ngoài transaction
-- với value mới. Prisma deploy chạy mỗi migration trong transaction riêng,
-- nhưng vẫn không cho reference value mới trong cùng transaction. Dùng
-- ALTER TYPE riêng — migration không reference giá trị FAST_TRACK ngay.
ALTER TYPE "ReviewMode" ADD VALUE 'FAST_TRACK';

-- AlterTable: 3 field govCert* nullable, chỉ điền khi reviewMode=FAST_TRACK.
ALTER TABLE "certifications" ADD COLUMN     "govCertNumber" TEXT,
ADD COLUMN     "govCertIssuedAt" TIMESTAMP(3),
ADD COLUMN     "govCertIssuer" TEXT;
