import { db } from "@/db";
import { media } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Отдаёт файлы, загруженные через админку (хранятся в БД) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(String(id).split(".")[0]);
  if (!numId) return new Response("Not found", { status: 404 });
  const [file] = await db.select().from(media).where(eq(media.id, numId));
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
