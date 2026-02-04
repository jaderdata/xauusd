import { NextResponse } from 'next/server';

// Simple in-memory storage (Resets on server restart)
// In production, use a database.
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
    
    // Update state
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
