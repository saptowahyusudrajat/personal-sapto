import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { device_id, temperature, humidity, timestamp } = body;

    if (!device_id || temperature === undefined || humidity === undefined || !timestamp) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('sensor_readings')
      .insert([
        {
          device_id,
          temperature: parseFloat(temperature),
          humidity: parseFloat(humidity),
          timestamp: parseInt(timestamp),
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const deviceId = searchParams.get('device_id');
    const days = parseInt(searchParams.get('days') || '7');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let query = supabase.from('sensor_readings').select('*');

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    // Filter by custom date range jika disediakan
    if (startDate && endDate) {
      const start = new Date(startDate).getTime() / 1000;
      const end = new Date(endDate).getTime() / 1000;
      query = query.gte('timestamp', start).lte('timestamp', end);
    } else {
      // Default: last N days
      const now = Math.floor(Date.now() / 1000);
      const pastTime = now - days * 24 * 60 * 60;
      query = query.gte('timestamp', pastTime);
    }

    query = query.order('timestamp', { ascending: true });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
