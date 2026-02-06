import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'mt5_config.json');

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { login, password, server } = body;

        if (!login || !password || !server) {
            return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 400 });
        }

        const config = {
            login: Number(login),
            password: password,
            server: server
        };

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return NextResponse.json({ success: true, message: 'Configuration saved' });
    } catch (error) {
        console.error('Settings Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to save settings' }, { status: 500 });
    }
}

export async function GET() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(data);
            // Hide password for security in GET
            return NextResponse.json({ ...config, password: '****' });
        }
        return NextResponse.json({ login: null, server: null });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
    }
}
