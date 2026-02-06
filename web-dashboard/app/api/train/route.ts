import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST() {
    return new Promise((resolve) => {
        const pythonScript = path.join(process.cwd(), 'ai_engine.py');
        console.log('Starting AI Training:', pythonScript);

        exec(`python "${pythonScript}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Exec error: ${error}`);
                resolve(NextResponse.json({
                    success: false,
                    error: error.message,
                    stderr
                }, { status: 500 }));
                return;
            }

            console.log(`Training output: ${stdout}`);
            resolve(NextResponse.json({
                success: true,
                output: stdout
            }));
        });
    });
}
