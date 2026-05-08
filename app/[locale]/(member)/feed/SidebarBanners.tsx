import Link from "next/link"
import Image from "next/image"
import { prisma } from "@/lib/prisma"
import { Skeleton } from "@/components/ui/skeleton"

async function fetchSidebarBanners() {
  const now = new Date()
  return prisma.banner.findMany({
    where: {
      status: "ACTIVE",
      positions: { has: "FEED_SIDEBAR" },
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: [{ user: { contributionTotal: "desc" } }, { createdAt: "desc" }],
    take: 5,
    select: { id: true, title: true, imageUrl: true, targetUrl: true },
  })
}

export async function SidebarBanners() {
  const banners = await fetchSidebarBanners()

  return (
    <div className="sticky top-20 space-y-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-brand-400">
        Quảng cáo
      </p>
      {banners.length > 0 ? (
        <div className="space-y-3">
          {banners.map((b) => (
            <a
              key={b.id}
              href={b.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={b.title}
              className="block overflow-hidden rounded-xl border border-brand-200 bg-white hover:shadow-md transition-shadow"
            >
              <div className="relative w-full" style={{ aspectRatio: "2 / 3" }}>
                <Image
                  src={b.imageUrl}
                  alt={b.title}
                  fill
                  className="object-cover"
                  sizes="320px"
                />
              </div>
            </a>
          ))}
        </div>
      ) : (
        <Link
          href="/banner/dang-ky"
          className="block rounded-xl border-2 border-dashed border-brand-300 bg-white/80 p-5 text-center hover:bg-white hover:border-brand-500 transition-colors"
          style={{ aspectRatio: "2 / 3" }}
        >
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
              <span className="text-brand-700 text-xl font-bold">+</span>
            </div>
            <p className="text-sm font-semibold text-brand-800">Đặt banner quảng cáo</p>
            <p className="text-xs text-brand-500 leading-relaxed">
              Hiển thị banner dọc tại vị trí này trên /feed. Đăng ký 1 tháng → hàng nghìn lượt xem.
            </p>
            <span className="text-xs font-semibold text-brand-700 underline underline-offset-2 mt-1">
              Đăng ký ngay →
            </span>
          </div>
        </Link>
      )}
    </div>
  )
}

export function SidebarBannersSkeleton() {
  // Render 5 placeholder match số banner tối đa (`take: 5` ở fetchSidebarBanners)
  // để tránh CLS khi content stream in: skeleton 1 banner → real 1-5 banners
  // sẽ phình sidebar đẩy footer xuống.
  return (
    <div className="sticky top-20 space-y-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-brand-400">
        Quảng cáo
      </p>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="w-full rounded-xl" style={{ aspectRatio: "2 / 3" }} />
        ))}
      </div>
    </div>
  )
}
