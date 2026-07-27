import { NextRequest, NextResponse } from 'next/server';
import { parseFeedback } from '@/lib/parser';

export async function POST(req: NextRequest) {
  try {
    const { raw_text } = await req.json();

    if (!raw_text || typeof raw_text !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid raw_text in request body' }, { status: 400 });
    }

    const parsed = parseFeedback(raw_text);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kesalahan tidak diketahui';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
