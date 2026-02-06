import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';

initDB();

export async function POST(request: Request) {
    try {
        const { candles, timeframe } = await request.json();

        if (Array.isArray(candles) && timeframe) {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO candles (time, timeframe, open, high, low, close, volume)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            const insertMany = db.transaction((data) => {
                for (const c of data) {
                    stmt.run(Number(c.time), timeframe, Number(c.open), Number(c.high), Number(c.low), Number(c.close), Number(c.volume || 0));
                }
            });

            insertMany(candles);
            console.log(`Persisted ${candles.length} [${timeframe}] candles to SQLite.`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('History POST Error:', error);
        return NextResponse.json({ success: false, error: 'Database Error' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const tf = searchParams.get('tf') || 'M15';

        const stmt = db.prepare('SELECT * FROM candles WHERE timeframe = ? ORDER BY time ASC');
        const rows = stmt.all(tf);
        console.log(`History GET [${tf}]: Returning ${rows.length} candles`);
        return NextResponse.json(rows);
    } catch (error) {
        console.error('History GET Error:', error);
        return NextResponse.json([]);
    }
}
