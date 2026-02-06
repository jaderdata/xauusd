import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST() {
    return new Promise((resolve) => {
        const bridgeScript = path.join(process.cwd(), 'bridge.py');
        console.log('Watchdog: Triggering Bridge Restart...');

        // Kill any existing bridge and start a new one
        const command = `taskkill /F /IM python.exe /T & start python "${bridgeScript}"`;

        exec(command, (error, stdout, stderr) => {
            // We ignore errors from taskkill if no process was found
            console.log('Watchdog: Bridge restart command executed.');
            resolve(NextResponse.json({
                success: true,
                message: 'Restart command issued'
            }));
        });
    });
}
