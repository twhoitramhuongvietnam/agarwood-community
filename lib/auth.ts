import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { cookies, headers } from "next/headers"
import { prisma } from "./prisma"
import { authConfig } from "./auth.config"
import {
  getClientIpFromHeaders,
  getTermsDocument,
  recordTermsAcceptance,
} from "./terms"
import type { Role, Committee } from "@prisma/client"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,

    /**
     * Control whether a sign-in is allowed.
     * For OAuth (Google): allow sign-in, handle new users in jwt callback.
     * For Credentials: handled in authorize().
     */
    async signIn({ user, account }) {
      if (account?.provider === "google" && user?.email) {
        // Check if user exists
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, isActive: true, role: true },
        })

        if (dbUser) {
          // Phase 3 (Cách A): user inactive = ĐỀU chặn login, bất kể role.
          //  - VIP/ADMIN inactive = admin chủ động disable
          //  - GUEST inactive = đơn đăng ký chưa được admin duyệt
          // User sẽ thấy trang error mặc định của NextAuth + được hướng dẫn
          // qua email "đã nhận đơn, chờ duyệt" khi đăng ký.
          if (!dbUser.isActive) return false

          // Link Google account to existing user if not already linked
          const existingAccount = await prisma.account.findFirst({
            where: { userId: dbUser.id, provider: "google" },
          })
          if (!existingAccount && account.providerAccountId) {
            await prisma.account.create({
              data: {
                userId: dbUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            })
          }
          return true
        }

        // Đọc cookie `pending_account_type` + `pending_terms_version` do
        // GoogleSignUpButton ghi trước khi redirect sang Google. Nếu không có
        // pending_terms_version → user vào thẳng /api/auth/signin (bypass UI)
        // hoặc cookie hết hạn — chặn tạo user vì chưa có bằng chứng đồng ý.
        let selectedAccountType: "BUSINESS" | "INDIVIDUAL" = "BUSINESS"
        let pendingTermsVersion: string | null = null
        try {
          const cookieStore = await cookies()
          const pending = cookieStore.get("pending_account_type")?.value
          if (pending === "INDIVIDUAL" || pending === "BUSINESS") {
            selectedAccountType = pending
          }
          pendingTermsVersion = cookieStore.get("pending_terms_version")?.value ?? null
        } catch {
          // cookies() có thể không khả dụng trong mọi context — fallback BUSINESS
        }

        // Bằng chứng đồng ý điều khoản BẮT BUỘC cho user mới — không có cookie
        // hoặc version không hợp lệ → từ chối sign-in, user phải quay lại trang
        // đăng ký tick checkbox.
        if (
          !pendingTermsVersion ||
          !getTermsDocument("REGISTRATION", pendingTermsVersion)
        ) {
          return false
        }

        // Phase 2: tạo user kích hoạt ngay (free tier — post được nhưng quota thấp).
        const userName = user.name ?? user.email.split("@")[0]

        // Nếu BUSINESS → tạo kèm Company shell để user edit sau ở /doanh-nghiep/chinh-sua,
        // đồng nhất với flow đăng ký manual. Tránh trường hợp user BUSINESS
        // không có company → list /hoi-vien không có link "Xem chi tiết".
        const companySlug = selectedAccountType === "BUSINESS"
          ? userName
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/đ/g, "d")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              + "-" + Date.now().toString(36)
          : null

        // Lấy IP + UA để ghi vào TermsAcceptance — bằng chứng pháp lý.
        let acceptanceIp: string | null = null
        let acceptanceUa: string | null = null
        try {
          const reqHeaders = await headers()
          acceptanceIp = getClientIpFromHeaders(reqHeaders)
          acceptanceUa = reqHeaders.get("user-agent")
        } catch {
          // headers() có thể fail trong vài context — chấp nhận null
        }

        // Tạo user + TermsAcceptance atomically — fail thì rollback cả 2.
        const newUser = await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email: user.email!,
              name: userName,
              avatarUrl: user.image ?? null,
              role: "GUEST",
              accountType: selectedAccountType,
              // Phase 3 (Cách A): đơn đăng ký qua Google cũng phải chờ admin duyệt.
              isActive: false,
              accounts: {
                create: {
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                },
              },
              ...(companySlug && {
                company: {
                  create: {
                    name: userName, // tạm lấy tên user, user tự edit sau
                    slug: companySlug,
                    description: "",
                    isVerified: false,
                    isPublished: false,
                  },
                },
              }),
            },
          })
          await recordTermsAcceptance(
            {
              userId: created.id,
              type: "REGISTRATION",
              version: pendingTermsVersion!,
              ipAddress: acceptanceIp,
              userAgent: acceptanceUa,
              contextRef: null,
            },
            tx,
          )
          return created
        })

        // Notify admin
        try {
          const { Resend } = await import("resend")
          const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key")
          const adminEmail = (await prisma.siteConfig.findUnique({ where: { key: "association_email" } }))?.value ?? "admin@hoitramhuong.vn"
          await resend.emails.send({
            from: "Hội Trầm Hương Việt Nam <noreply@hoitramhuong.vn>",
            to: adminEmail,
            subject: `[Đăng ký mới qua Google] ${user.name ?? user.email}`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;">
                <h3>Đơn đăng ký hội viên mới (Google)</h3>
                <p><strong>Họ tên:</strong> ${user.name}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Avatar:</strong> <img src="${user.image}" width="40" height="40" style="border-radius:50%;" /></p>
                <p style="color:#888;">Người dùng đăng ký qua Google OAuth. Cần duyệt tại trang quản lý hội viên.</p>
                <p><a href="${process.env.NEXTAUTH_URL}/admin/hoi-vien?status=registration" style="display:inline-block;background:#1a5632;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Xem đơn đăng ký</a></p>
              </div>
            `,
          })
        } catch (err) {
          console.error("Failed to send Google registration notification:", err)
        }

        // Ack email cho user — thông báo đơn đã nhận, chờ duyệt.
        try {
          const { Resend } = await import("resend")
          const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key")
          await resend.emails.send({
            from: "Hội Trầm Hương Việt Nam <noreply@hoitramhuong.vn>",
            to: user.email,
            subject: "Đã nhận đơn đăng ký — Hội Trầm Hương Việt Nam",
            html: `
              <div style="font-family:sans-serif;max-width:600px;">
                <h2>Xin chào ${userName},</h2>
                <p>Chúng tôi đã <strong>tiếp nhận đơn đăng ký hội viên</strong> của bạn qua Google.</p>
                <p>Ban quản trị sẽ xem xét và phản hồi trong vòng <strong>1–2 ngày làm việc</strong>. Khi đơn được chấp thuận, bạn có thể đăng nhập lại bằng Google để sử dụng tài khoản.</p>
                <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
                <p style="color:#888;font-size:12px;">Hội Trầm Hương Việt Nam</p>
              </div>
            `,
          })
        } catch (err) {
          console.error("Failed to send Google ack email:", err)
        }

        // Phase 3 (Cách A): KHÔNG cho login lần này — user phải chờ admin
        // duyệt. NextAuth sẽ redirect về /login với error. User sẽ hiểu qua
        // ack email vừa gửi.
        void newUser
        return false
      }

      return true // Credentials handled in authorize()
    },

    /**
     * Runs server-side on sign-in and on JWT refresh.
     * Embeds role + membershipExpires into the JWT so middleware
     * can check them without a DB round-trip (Edge-safe).
     */
    async jwt({ token, user, account }) {
      // Helper gom query role + membership + committees — embed vào JWT để
      // proxy (Edge) có đủ info gate /admin routes mà không cần DB query.
      const fetchUserShape = async (userId: string) => {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            role: true,
            membershipExpires: true,
            committeeMemberships: { select: { committee: true } },
          },
        })
        if (!dbUser) return null
        return {
          role: dbUser.role,
          membershipExpires: dbUser.membershipExpires?.toISOString() ?? null,
          committees: dbUser.committeeMemberships.map((m) => m.committee),
        }
      }

      // On first sign-in (user is present)
      if (user?.id) {
        const shape = await fetchUserShape(user.id)
        if (shape) {
          token.role = shape.role
          token.membershipExpires = shape.membershipExpires
          token.committees = shape.committees
          token.refreshedAt = Date.now()
        }
        return token
      }

      // For Google OAuth new users, ensure we use the DB user id
      if (account?.provider === "google" && user?.email && !user.id) {
        const byEmail = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true },
        })
        if (byEmail) {
          token.sub = byEmail.id
          const shape = await fetchUserShape(byEmail.id)
          if (shape) {
            token.role = shape.role
            token.membershipExpires = shape.membershipExpires
            token.committees = shape.committees
            token.refreshedAt = Date.now()
          }
        }
        return token
      }

      // Subsequent requests — refresh role/membership/committees từ DB tối đa
      // 60s/lần để tránh JWT stale khi admin gán ban / xác nhận thanh toán.
      const REFRESH_TTL_MS = 60_000
      const refreshedAt = (token.refreshedAt as number | undefined) ?? 0
      if (token.sub && Date.now() - refreshedAt > REFRESH_TTL_MS) {
        const shape = await fetchUserShape(token.sub)
        if (shape) {
          token.role = shape.role
          token.membershipExpires = shape.membershipExpires
          token.committees = shape.committees
          token.refreshedAt = Date.now()
        }
      }

      return token
    },

    /**
     * Shapes the session object exposed to the app via `auth()` / `useSession()`.
     * Reads from JWT — no DB query.
     */
    async session({ session, token }) {
      session.user.id = token.sub!
      session.user.role = token.role as Role
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(session.user as any).membershipExpires = (token.membershipExpires as string | null) ?? null
      session.user.committees = (token.committees as Committee[] | undefined) ?? []
      return session
    },
  },

  providers: [
    ...authConfig.providers,

    // Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),

    Credentials({
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            passwordHash: true,
            isActive: true,
            role: true,
          },
        })

        if (!user?.passwordHash) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!valid) return null

        // Phase 3 (Cách A): inactive = chặn login ĐỀU, bất kể role.
        //  - VIP/ADMIN inactive = admin disable
        //  - GUEST inactive = đơn chưa được admin duyệt
        if (!user.isActive) return null

        return { id: user.id, name: user.name, email: user.email, image: user.avatarUrl }
      },
    }),
  ],
})
