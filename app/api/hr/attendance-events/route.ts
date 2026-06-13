import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/backend/db';
import { processAttendancePunch } from '@/app/actions/attendance-actions';

// GET heartbeat
export async function GET() {
    return NextResponse.json({ status: 'ok' }, { status: 200 });
}

// POST webhook
export async function POST(req: NextRequest) {
    try {
        // 1. Read raw body as text for HMAC verification
        const rawBody = await req.text();

        // 2. Read headers
        const signature = req.headers.get('x-hmac-signature');
        const deviceCode = req.headers.get('x-device-code');
        const headerTimestamp = req.headers.get('x-timestamp');

        if (!signature || !deviceCode || !headerTimestamp) {
            return NextResponse.json({ error: 'Missing headers' }, { status: 401 });
        }

        // 3. Replay protection (5 minutes = 300 seconds)
        let timestamp = parseInt(headerTimestamp, 10);
        if (timestamp > 9999999999) {
            // timestamp is in milliseconds, convert to seconds
            timestamp = Math.floor(timestamp / 1000);
        }
        const now = Math.floor(Date.now() / 1000);
        if (isNaN(timestamp) || Math.abs(now - timestamp) > 300) {
            return NextResponse.json({ error: 'Request expired' }, { status: 400 });
        }

        // 4. Fetch AttendanceDevice from DB by device_code
        const device = await prisma.attendanceDevice.findUnique({
            where: { device_code: deviceCode }
        });

        if (!device || !device.is_active) {
            return NextResponse.json({ error: 'Device not found or inactive' }, { status: 401 });
        }

        // 5. Compute HMAC-SHA256
        const computedSignature = crypto
            .createHmac('sha256', device.webhook_secret)
            .update(rawBody)
            .digest('hex');

        // 6. Secure comparison to prevent timing attacks
        const signatureBuffer = Buffer.from(signature, 'hex');
        const computedBuffer = Buffer.from(computedSignature, 'hex');

        if (
            signatureBuffer.length !== computedBuffer.length ||
            !crypto.timingSafeEqual(signatureBuffer, computedBuffer)
        ) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // 7. Parse body
        let body;
        try {
            body = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        const { employee_code, punch_time, direction } = body;
        if (!employee_code || !punch_time) {
            return NextResponse.json({ error: 'Missing employee_code or punch_time' }, { status: 400 });
        }

        // 8. Find Employee by employee_code
        // Note: organizationId matches the device's organizationId
        const employee = await prisma.employee.findFirst({
            where: {
                employee_code: employee_code,
                organizationId: device.organizationId
            }
        });

        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        const punchTimeDate = new Date(punch_time);

        // 9. Create AttendancePunch and catch duplicate check silently
        try {
            await prisma.attendancePunch.create({
                data: {
                    employee_id: employee.id,
                    punch_time: punchTimeDate,
                    direction: direction || null,
                    source: 'BIOMETRIC',
                    device_id: deviceCode,
                    raw_payload: body,
                    organizationId: device.organizationId
                }
            });
        } catch (err: any) {
            if (err.code !== 'P2002') {
                throw err;
            }
            // Duplicate punch is fine, return 200
        }

        // 10. Update device last_seen_at
        await prisma.attendanceDevice.update({
            where: { id: device.id },
            data: { last_seen_at: new Date() }
        });

        // 11. Trigger processAttendancePunch asynchronously (fire-and-forget)
        processAttendancePunch(employee.id, punchTimeDate, device.organizationId).catch(console.error);

        return NextResponse.json({ status: 'accepted' }, { status: 200 });
    } catch (error: any) {
        console.error('Error in webhook POST:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
