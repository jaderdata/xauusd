import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(request: Request) {
    const { symbol, startDate, endDate, timeframe } = await request.json();

    return new Promise((resolve) => {
        const pythonScript = path.join(process.cwd(), 'backtest_engine.py');
        console.log('Starting Backtest:', pythonScript);

        const command = `python "${pythonScript}" "${symbol}" "${startDate}" "${endDate}" "${timeframe || 'M15'}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Backtest error: ${error}`);
                resolve(NextResponse.json({
                    success: false,
                    error: error.message,
                    stderr
                }, { status: 500 }));
                return;
            }

            try {
                const result = JSON.parse(stdout);
                resolve(NextResponse.json({
                    success: true,
                    data: result
                }));
            } catch (e) {
                console.error("Failed to parse backtest output:", stdout);
                resolve(NextResponse.json({
                    success: false,
                    error: "Invalid JSON output from engine",
                    raw: stdout
                }, { status: 500 }));
            }
        });
    });
}
