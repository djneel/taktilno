import { NextResponse, type NextRequest } from "next/server";

import { getPostOfficeByIndex } from "@/lib/delivery/russian-post";

/**
 * GET /api/delivery/russian-post/office?index=... — отделение Почты России
 * по индексу (справочник DaData). Информационная подсказка в чекауте:
 * всегда отвечает 200, при проблемах фронт просто прячет карточку.
 */
export async function GET(request: NextRequest) {
  const index = new URL(request.url).searchParams.get("index")?.trim() ?? "";
  if (index.replace(/\D/g, "").length !== 6) {
    return NextResponse.json({ ok: false, office: null, detail: "Нужен 6-значный индекс" });
  }
  const result = await getPostOfficeByIndex(index);
  return NextResponse.json(result);
}
