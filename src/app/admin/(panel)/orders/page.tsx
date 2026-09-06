import Link from "next/link";
import { db } from "@/db";
import { orders, ORDER_STATUSES, type OrderStatus } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Badge, PageTitle } from "@/components/admin/ui";
import { formatDate, formatPrice } from "@/lib/utils";
import { DELIVERY_METHODS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
  const list = await db.query.orders.findMany({
    where: filter ? eq(orders.status, filter) : undefined,
    with: { items: true },
    orderBy: [desc(orders.createdAt)],
  });

  return (
    <>
      <PageTitle title="Заказы" />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <Link href="/admin/orders" className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-semibold leading-10 ring-1", !filter ? "bg-fg text-bg ring-fg" : "bg-card text-muted ring-line/60")}>Все</Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={`/admin/orders?status=${s}`} className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-semibold leading-10 ring-1", filter === s ? "bg-fg text-bg ring-fg" : "bg-card text-muted ring-line/60")}>
            {ORDER_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl bg-card ring-1 ring-line/60">
        {list.length === 0 ? (
          <p className="p-8 text-center text-muted">Заказов нет.</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="grid gap-2 p-4 hover:bg-bg2/50 sm:grid-cols-[120px_1fr_auto] sm:items-center">
                  <div>
                    <div className="font-bold">{o.number}</div>
                    <div className="text-xs text-muted">{formatDate(o.createdAt)}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm">
                      <span className="font-semibold">{o.customerName}</span> · {o.phone} · {o.email}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")} · {o.city} · {DELIVERY_METHODS.find((d) => d.id === o.deliveryMethod)?.name ?? o.deliveryMethod}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="font-bold">{formatPrice(o.total)}</span>
                    <Badge tone={o.paymentStatus === "paid" ? "green" : "pink"}>{PAYMENT_STATUS_LABELS[o.paymentStatus]}</Badge>
                    <Badge tone={o.status === "new" ? "green" : "muted"}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
