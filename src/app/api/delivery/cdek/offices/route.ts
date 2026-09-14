import { NextResponse, type NextRequest } from "next/server";

import { getCdekOffices } from "@/lib/delivery/cdek";

/**
 * GET /api/delivery/cdek/offices?city=... — список ПВЗ и постаматов СДЭК
 * для выбора в чекауте. Всегда отвечает 200 с флагом ok, чтобы фронт мог
 * показать ручной ввод адреса как запасной путь.
 */
export async function GET(request: NextRequest) {
  const city = new URL(request.url).searchParams.get("city")?.trim() ?? "";
  if (city.length < 2) {
    return NextResponse.json({
      ok: false,
      offices: [],
      cityCode: null,
      reason: "empty-city",
      detail: "Укажите город",
    });
  }
  const result = await getCdekOffices(city);
  return NextResponse.json(result);
}
