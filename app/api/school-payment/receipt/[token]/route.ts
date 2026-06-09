import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parsePaymentReceipt } from '@/lib/school/payment-receipt';
import { generateReceiptPdfBuffer } from '@/lib/school/generate-receipt-pdf';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token?.trim()) {
      return NextResponse.json({ error: 'Token requis' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_school_payment_receipt_by_token', {
      p_token: token,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const receipt = parsePaymentReceipt(data);
    if (!receipt) {
      return NextResponse.json({ error: 'Reçu introuvable' }, { status: 404 });
    }

    const pdf = generateReceiptPdfBuffer(receipt);
    const filename = `${receipt.receipt_number ?? 'recu'}.pdf`;

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
