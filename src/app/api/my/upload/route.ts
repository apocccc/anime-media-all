import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { storeImage } from "@/lib/media-store";

export const runtime = "nodejs";

const MAX_MB = Number(process.env.UPLOAD_MAX_MB || 8);

/** 会員の投稿画像アップロード(ログイン必須) */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const alt = (formData.get("alt") as string) ?? "";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "not an image" }, { status: 400 });
  }

  try {
    const media = await storeImage(
      Buffer.from(await file.arrayBuffer()),
      alt.slice(0, 200),
      session.user.id
    );
    return NextResponse.json(media);
  } catch (e) {
    console.error("[my/upload] failed:", e);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
