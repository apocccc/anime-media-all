import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // 静的ファイル・API・管理画面・事業者ポータル・マイページ・フィード類は除外
  matcher: ["/((?!api|admin|partner|my|_next|_vercel|.*\\..*).*)"],
};
