import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';

// Ensure DB is ready
initDB();

export async function POST(request: Request) {
    try {
        const data = await request.json();

        // Insert into DB
        const stmt = db.prepare(`
      INSERT INTO trades (id, symbol, side, price, vol, comment, timestamp) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        const id = Math.random().toString(36).substring(7);
        const timestamp = Date.now();

        stmt.run(
            id,
            data.symbol,
            data.side,
            data.price,
            data.vol,
            data.comment,
            timestamp
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: 'Database Error' }, { status: 500 });
    }
}

export async function GET() {
    // Get last 50 trades ordered by latest
    const stmt = db.prepare('SELECT * FROM trades ORDER BY timestamp DESC LIMIT 50');
    const rows = stmt.all();
    return NextResponse.json(rows);
}
