import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getPool, query, queryOne } from "@/server/db";
import { assertCanViewBooking } from "@/server/access";
import { getOrCreateSba } from "@/server/sba";
import SbaEditor from "./SbaEditor";

export const dynamic = "force-dynamic";

export default async function SbaPage({
  params,
}: {
  params: Promise<{ id: string }>; // id peminjaman
}) {
  const user = await requireUser();
  const { id: bookingId } = await params;

  try {
    await assertCanViewBooking(getPool(), user, bookingId);
  } catch (err) {
    console.error("Access error for sba booking:", bookingId, user.id, err);
    notFound();
  }

  const booking = await queryOne<any>(
    `SELECT b.*, o.name AS org_name, f.name AS facility_name
     FROM bookings b
     JOIN organizations o ON o.id = b.organization_id
     JOIN facilities f ON f.id = b.facility_id
     WHERE b.id = $1`,
    [bookingId]
  );
  if (!booking) notFound();

  const sba = await getOrCreateSba(user, bookingId);

  const [rundownItems, financeItems, attachments] = await Promise.all([
    query<any>(`SELECT * FROM sba_rundown_items WHERE sba_id = $1 ORDER BY item_order ASC`, [sba.id]),
    query<any>(`SELECT * FROM sba_finance_items WHERE sba_id = $1 ORDER BY id ASC`, [sba.id]),
    query<any>(`SELECT * FROM attachments WHERE sba_id = $1 ORDER BY created_at DESC`, [sba.id]),
  ]);

  const isOwner = user.role === "ORG" && user.organizationId === booking.organization_id;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Laporan SBA Kegiatan
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
            {booking.title}
          </h2>
          <p className="text-xs text-slate-500">
            Peminjaman: <Link href={`/dashboard/peminjaman/${booking.id}`} className="underline font-mono">{booking.code}</Link> • Status SBA: <strong>{sba.status}</strong>
          </p>
        </div>
        <Link
          href={`/dashboard/peminjaman/${booking.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition shadow-2xs"
        >
          <span>←</span>
          <span>Kembali ke Detail Peminjaman</span>
        </Link>
      </div>

      <SbaEditor
        sba={sba}
        booking={booking}
        rundownItems={rundownItems}
        financeItems={financeItems}
        isOwner={isOwner}
      />
    </div>
  );
}
