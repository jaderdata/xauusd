import { NextResponse } from 'next/server';

// For ticks, we use a global variable (since we don't necessarily need to persist every single tick to DB for the dashboard stats)
// But we keep it simple for now. 
let latestTick = {
  symbol: 'XAUUSD',
  bid: 0,
  ask: 0,
  equity: 0,
  profit: 0,
  timestamp: Date.now(),
};

export async function POST(request: Request) {
  try {
    const data = await request.json();

    latestTick = {
      ...data,
      timestamp: Date.now(),
    };

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json(latestTick);
}
