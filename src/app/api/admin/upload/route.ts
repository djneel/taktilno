import { NextResponse } from "next/server";
import { db } from "@/db";
import { media, productImages, type ImageKind, IMAGE_KINDS } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024; // 10 МБ
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

/**
 * Загрузка изображений из админки.
 * multipart/form-data: files[] (одно или несколько), опционально productId и kind.
 * Файлы хранятся в таблице media и отдаются через /api/media/:id
 */
export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const productId = Number(form.get("productId") ?? 0) || null;
  const kindRaw = String(form.get("kind") ?? "detail") as ImageKind;
  const kind: ImageKind = IMAGE_KINDS.includes(kindRaw) ? kindRaw : "detail";

  if (!files.length) return NextResponse.json({ error: "Нет файлов" }, { status: 400 });

  const results: { url: string; mediaId: number; imageId?: number }[] = [];

  for (const file of files) {
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: `Формат ${file.type || "файла"} не поддерживается` }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `Файл ${file.name} больше 10 МБ` }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const [m] = await db
      .insert(media)
      .values({ filename: file.name, mimeType: file.type, size: buf.length, data: buf })
      .returning({ id: media.id });
    const url = `/api/media/${m.id}`;

    let imageId: number | undefined;
    if (productId) {
      const [{ max }] = await db
        .select({ max: sql<number>`coalesce(max(${productImages.sortOrder}), -1)::int` })
        .from(productImages)
        .where(eq(productImages.productId, productId));
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(productImages)
        .where(eq(productImages.productId, productId));
      const [img] = await db
        .insert(productImages)
        .values({
          productId,
          url,
          mediaId: m.id,
          kind: count === 0 ? "main" : kind,
          alt: file.name.replace(/\.[^.]+$/, ""),
          sortOrder: max + 1,
        })
        .returning({ id: productImages.id });
      imageId = img.id;
    }
    results.push({ url, mediaId: m.id, imageId });
  }

  revalidatePath("/", "layout");
  return NextResponse.json({ files: results });
}
