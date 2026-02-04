import { NextResponse } from 'next/server';

// Command Queue (FIFO)
// In memory for now.
let commandQueue: string[] = [];

export async function POST(request: Request) {
    try {
        const { command } = await request.json();
        if (command) {
            console.log(`Command Received: ${command}`);
            commandQueue.push(command);
        }
        return NextResponse.json({ success: true, queueSize: commandQueue.length });
    } catch (error) {
        return NextResponse.json({ success: false }, { status: 400 });
    }
}

// EA Polls this endpoint
export async function GET() {
    // If queue has items, pop the oldest one and return it
    if (commandQueue.length > 0) {
        const cmd = commandQueue.shift(); // Remove from queue
        return NextResponse.json({ command: cmd });
    }

    return NextResponse.json({ command: null });
}
