import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function GET() {
    return new Promise((resolve) => {
        const pythonScript = path.join(process.cwd(), 'news_engine.py');

        exec(`python "${pythonScript}" --json`, (error, stdout, stderr) => {
            if (error) {
                console.error(`News error: ${error}`);
                resolve(NextResponse.json({
                    success: false,
                    error: error.message
                }, { status: 500 }));
                return;
            }

            try {
                const news = JSON.parse(stdout);
                resolve(NextResponse.json({ success: true, news }));
            } catch (e) {
                console.error("Failed to parse news output:", stdout);
                resolve(NextResponse.json({ success: false, error: "Parse error", raw: stdout }));
            }
        });
    });
}
