'use server';

import { requireTenantContext, requireRoleAndTenant } from '@/backend/tenant';
import { prisma } from '@/backend/db';
import { revalidatePath } from 'next/cache';
import { AttendanceSource, RegularizationType, RegularizationStatus } from '@prisma/client';

// Helper to strip time to UTC midnight
function getUTCDateOnly(date: Date | string): Date {
    const d = new Date(date);
    // Strip time to UTC midnight
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

// Helper for audit logging
async function writeAuditLog({
    action,
    performedBy,
    targetEmployeeId,
    organizationId,
    metadata,
}: {
    action: string;
    performedBy: string;
    targetEmployeeId: number;
    organizationId: string;
    metadata: any;
}) {
    try {
        // Find the user performing the action to get their details
        const user = await prisma.user.findUnique({
            where: { id: performedBy }
        });

        await prisma.system_audit_logs.create({
            data: {
                user_id: performedBy,
                username: user?.username ?? 'unknown',
                role: user?.role ?? 'unknown',
                action,
                module: 'HR_Attendance',
                entity_type: 'Employee',
                entity_id: String(targetEmployeeId),
                details: JSON.stringify({
                    target_employee_id: targetEmployeeId,
                    metadata
                }),
                organizationId,
            }
        });
    } catch (err) {
        console.error('[AUDIT LOG FAILED]', err);
    }
}

// ─── FUNCTION 1: processAttendancePunch ───
export async function processAttendancePunch(
    employeeId: number,
    punchDate: Date,
    organizationId: string
): Promise<void> {
    try {
        const dateOnly = getUTCDateOnly(punchDate);
        const nextDay = new Date(dateOnly);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);

        // 1. Fetch org's AttendancePolicy or use defaults
        let policy = await prisma.attendancePolicy.findUnique({
            where: { organizationId }
        });
        if (!policy) {
            policy = {
                id: 0,
                organizationId,
                grace_minutes: 10,
                late_marks_for_half_day: 3,
                min_hours_full_day: 8.0,
                min_hours_half_day: 4.0,
                sandwich_rule_enabled: false,
                max_regularizations_month: 3,
                created_at: new Date(),
                updated_at: new Date()
            };
        }

        // 2. Get all AttendancePunch rows for this employee on this calendar date, ordered by punch_time asc
        const punches = await prisma.attendancePunch.findMany({
            where: {
                employee_id: employeeId,
                organizationId,
                punch_time: {
                    gte: dateOnly,
                    lt: nextDay
                }
            },
            orderBy: { punch_time: 'asc' }
        });

        // 3. If no punches found, return early
        if (punches.length === 0) return;

        // 4. Identify checkIn = first punch time, checkOut = last punch time (null if only 1 punch)
        const checkIn = punches[0].punch_time;
        const checkOut = punches.length > 1 ? punches[punches.length - 1].punch_time : null;

        // 5. Fetch the employee's ShiftAssignment for this date, include ShiftPattern
        const shiftAssignment = await prisma.shiftAssignment.findFirst({
            where: {
                employee_id: employeeId,
                organizationId,
                date: dateOnly
            },
            include: { shift_pattern: true }
        });

        let lateMinutes = 0;
        let earlyOutMinutes = 0;
        let overtimeMinutes = 0;
        let workedHours = 0;
        let status = 'Present';
        let isNightShift = false;

        const shiftPattern = shiftAssignment?.shift_pattern;

        // 6. If ShiftPattern exists
        if (shiftPattern) {
            isNightShift = shiftPattern.is_overnight ?? false;

            // Parse shift start_time and end_time strings ("HH:MM") into Date objects for this calendar date
            const [startH, startM] = shiftPattern.start_time.split(':').map(Number);
            const [endH, endM] = shiftPattern.end_time.split(':').map(Number);

            const shiftStart = new Date(dateOnly);
            shiftStart.setUTCHours(startH, startM, 0, 0);

            const shiftEnd = new Date(dateOnly);
            shiftEnd.setUTCHours(endH, endM, 0, 0);

            if (isNightShift) {
                shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1);
            }

            // lateMinutes = max(0, floor((checkIn - shiftStart) / 60000) - policy.grace_minutes)
            lateMinutes = Math.max(0, Math.floor((checkIn.getTime() - shiftStart.getTime()) / 60000) - policy.grace_minutes);

            if (checkOut) {
                workedHours = (checkOut.getTime() - checkIn.getTime()) / 3600000;
                earlyOutMinutes = Math.max(0, Math.floor((shiftEnd.getTime() - checkOut.getTime()) / 60000));
                overtimeMinutes = Math.max(0, Math.floor((checkOut.getTime() - shiftEnd.getTime()) / 60000));

                if (workedHours < policy.min_hours_half_day) {
                    status = 'Absent';
                } else if (workedHours < policy.min_hours_full_day) {
                    status = 'Half-Day';
                } else {
                    status = 'Present';
                }
            } else {
                status = 'Incomplete';
            }
        } else {
            // 7. If no ShiftPattern
            if (checkOut) {
                workedHours = (checkOut.getTime() - checkIn.getTime()) / 3600000;
                status = workedHours < policy.min_hours_half_day ? 'Absent' : 
                         workedHours < policy.min_hours_full_day ? 'Half-Day' : 'Present';
            } else {
                status = 'Incomplete';
            }
        }

        // 8. Upsert Attendance using employee_id + date as the unique key
        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                employee_id: employeeId,
                organizationId,
                date: dateOnly
            }
        });

        const attendanceData = {
            employee_id: employeeId,
            date: dateOnly,
            check_in: checkIn,
            check_out: checkOut,
            total_hours: workedHours > 0 ? Math.round(workedHours * 100) / 100 : null,
            status,
            late_minutes: lateMinutes,
            early_out_minutes: earlyOutMinutes,
            overtime_minutes: overtimeMinutes,
            ot_approved: false,
            is_night_shift: isNightShift,
            source: punches[0].source, // Use source of the primary punch
            shift_assignment_id: shiftAssignment?.id || null,
            organizationId
        };

        if (existingAttendance) {
            await prisma.attendance.update({
                where: { id: existingAttendance.id },
                data: attendanceData
            });
        } else {
            await prisma.attendance.create({
                data: attendanceData
            });
        }

        // 9. Call applyLateMarkPolicy
        await applyLateMarkPolicy(employeeId, organizationId, dateOnly, policy);
        
        revalidatePath('/hr/attendance');
    } catch (error) {
        console.error('Error in processAttendancePunch:', error);
    }
}

// ─── FUNCTION 2: applyLateMarkPolicy (internal, not exported) ───
async function applyLateMarkPolicy(
    employeeId: number,
    organizationId: string,
    forDate: Date,
    policy: any
): Promise<void> {
    try {
        const year = forDate.getUTCFullYear();
        const month = forDate.getUTCMonth();
        const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

        // 1. Count Attendance rows for this employee in the same calendar month where late_minutes > 0
        const lateCount = await prisma.attendance.count({
            where: {
                employee_id: employeeId,
                organizationId,
                date: {
                    gte: startOfMonth,
                    lte: endOfMonth
                },
                late_minutes: {
                    gt: 0
                }
            }
        });

        // 2. If count > 0 AND count is a multiple of policy.late_marks_for_half_day
        if (lateCount > 0 && lateCount % policy.late_marks_for_half_day === 0) {
            // Find the most recent Present record in this month with late_minutes > 0
            const recentPresent = await prisma.attendance.findFirst({
                where: {
                    employee_id: employeeId,
                    organizationId,
                    date: {
                        gte: startOfMonth,
                        lte: endOfMonth
                    },
                    status: 'Present',
                    late_minutes: {
                        gt: 0
                    }
                },
                orderBy: { date: 'desc' }
            });

            if (recentPresent) {
                // Update its status to "Half-Day"
                await prisma.attendance.update({
                    where: { id: recentPresent.id },
                    data: { status: 'Half-Day' }
                });
            }
        }
    } catch (error) {
        console.error('Error in applyLateMarkPolicy:', error);
    }
}

// ─── FUNCTION 3: recordMobilePunch ───
export async function recordMobilePunch(data: {
    employeeId: number;
    organizationId: string;
    geoLat: number;
    geoLng: number;
    branchLat: number;
    branchLng: number;
    branchRadiusMeters: number;
}): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Compute Haversine distance
        const R = 6371000; // Earth radius in meters
        const phi1 = data.geoLat * Math.PI / 180;
        const phi2 = data.branchLat * Math.PI / 180;
        const deltaPhi = (data.branchLat - data.geoLat) * Math.PI / 180;
        const deltaLambda = (data.branchLng - data.geoLng) * Math.PI / 180;

        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        // 2. Geofence check
        if (distance > data.branchRadiusMeters) {
            return { success: false, error: 'You are outside the allowed area for punch-in.' };
        }

        const now = new Date();

        // 3. Create AttendancePunch
        try {
            await prisma.attendancePunch.create({
                data: {
                    employee_id: data.employeeId,
                    punch_time: now,
                    source: 'MOBILE',
                    geo_lat: data.geoLat,
                    geo_lng: data.geoLng,
                    organizationId: data.organizationId
                }
            });
        } catch (err: any) {
            // Catch unique constraint (duplicate punch) and ignore it
            if (err.code !== 'P2002') {
                throw err;
            }
        }

        // 4. Call processAttendancePunch
        await processAttendancePunch(data.employeeId, now, data.organizationId);

        revalidatePath('/hr/attendance');
        revalidatePath('/ess/attendance');
        return { success: true };
    } catch (error: any) {
        console.error('Error in recordMobilePunch:', error);
        return { success: false, error: error.message || 'Failed to record punch' };
    }
}

// ─── FUNCTION 4: recordManualAttendance ───
export async function recordManualAttendance(data: {
    employeeId: number;
    date: Date;
    checkIn: Date;
    checkOut: Date | null;
    reason: string;
    organizationId: string;
    enteredBy: string;
}): Promise<any> {
    try {
        const dateOnly = getUTCDateOnly(data.date);

        // Fetch org policy
        let policy = await prisma.attendancePolicy.findUnique({
            where: { organizationId: data.organizationId }
        });
        if (!policy) {
            policy = {
                id: 0,
                organizationId: data.organizationId,
                grace_minutes: 10,
                late_marks_for_half_day: 3,
                min_hours_full_day: 8.0,
                min_hours_half_day: 4.0,
                sandwich_rule_enabled: false,
                max_regularizations_month: 3,
                created_at: new Date(),
                updated_at: new Date()
            };
        }

        let totalHours: number | null = null;
        let status = 'Incomplete';

        if (data.checkOut) {
            totalHours = (data.checkOut.getTime() - data.checkIn.getTime()) / 3600000;
            totalHours = Math.round(totalHours * 100) / 100;

            if (totalHours < policy.min_hours_half_day) {
                status = 'Absent';
            } else if (totalHours < policy.min_hours_full_day) {
                status = 'Half-Day';
            } else {
                status = 'Present';
            }
        }

        // Fetch shift details if any
        const shiftAssignment = await prisma.shiftAssignment.findFirst({
            where: {
                employee_id: data.employeeId,
                organizationId: data.organizationId,
                date: dateOnly
            },
            include: { shift_pattern: true }
        });

        let lateMinutes = 0;
        let earlyOutMinutes = 0;
        let overtimeMinutes = 0;
        let isNightShift = false;

        const shiftPattern = shiftAssignment?.shift_pattern;
        if (shiftPattern) {
            isNightShift = shiftPattern.is_overnight ?? false;

            const [startH, startM] = shiftPattern.start_time.split(':').map(Number);
            const [endH, endM] = shiftPattern.end_time.split(':').map(Number);

            const shiftStart = new Date(dateOnly);
            shiftStart.setUTCHours(startH, startM, 0, 0);

            const shiftEnd = new Date(dateOnly);
            shiftEnd.setUTCHours(endH, endM, 0, 0);

            if (isNightShift) {
                shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1);
            }

            lateMinutes = Math.max(0, Math.floor((data.checkIn.getTime() - shiftStart.getTime()) / 60000) - policy.grace_minutes);
            if (data.checkOut) {
                earlyOutMinutes = Math.max(0, Math.floor((shiftEnd.getTime() - data.checkOut.getTime()) / 60000));
                overtimeMinutes = Math.max(0, Math.floor((data.checkOut.getTime() - shiftEnd.getTime()) / 60000));
            }
        }

        // Check if attendance already exists for this employee on this date (either local or UTC midnight)
        const dateObjLocal = new Date(data.date);
        dateObjLocal.setHours(0, 0, 0, 0);

        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                employee_id: data.employeeId,
                organizationId: data.organizationId,
                OR: [
                    { date: dateOnly },
                    { date: dateObjLocal }
                ]
            }
        });

        if (existingAttendance) {
            return {
                success: false,
                error: 'An attendance record already exists for this employee on this date.'
            };
        }

        const attendanceFields = {
            employee_id: data.employeeId,
            date: dateOnly,
            check_in: data.checkIn,
            check_out: data.checkOut,
            total_hours: totalHours,
            status,
            late_minutes: lateMinutes,
            early_out_minutes: earlyOutMinutes,
            overtime_minutes: overtimeMinutes,
            ot_approved: false,
            is_night_shift: isNightShift,
            source: AttendanceSource.MANUAL,
            shift_assignment_id: shiftAssignment?.id || null,
            organizationId: data.organizationId
        };

        const result = await prisma.attendance.create({
            data: attendanceFields
        });

        // Audit Logging
        await writeAuditLog({
            action: 'MANUAL_ATTENDANCE_ENTRY',
            performedBy: data.enteredBy,
            targetEmployeeId: data.employeeId,
            organizationId: data.organizationId,
            metadata: {
                date: dateOnly.toISOString(),
                check_in: data.checkIn.toISOString(),
                check_out: data.checkOut ? data.checkOut.toISOString() : null,
                reason: data.reason
            }
        });

        revalidatePath('/hr/attendance');
        return result;
    } catch (error) {
        console.error('Error in recordManualAttendance:', error);
        throw error;
    }
}

// ─── FUNCTION 5: submitRegularization ───
export async function submitRegularization(data: {
    employeeId: number;
    date: Date;
    type: 'MISSED_PUNCH' | 'ON_DUTY' | 'WFH';
    reason: string;
    requestedCheckIn?: Date;
    requestedCheckOut?: Date;
    organizationId: string;
}): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
        const dateOnly = getUTCDateOnly(data.date);
        const year = dateOnly.getUTCFullYear();
        const month = dateOnly.getUTCMonth();
        const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

        // 1. Fetch policy max_regularizations_month
        let policy = await prisma.attendancePolicy.findUnique({
            where: { organizationId: data.organizationId }
        });
        const maxLimit = policy?.max_regularizations_month ?? 3;

        // Count how many regularizations this employee has submitted this calendar month with status PENDING or APPROVED
        const currentMonthCount = await prisma.attendanceRegularization.count({
            where: {
                employee_id: data.employeeId,
                organizationId: data.organizationId,
                created_at: {
                    gte: startOfMonth,
                    lte: endOfMonth
                },
                status: {
                    in: [RegularizationStatus.PENDING, RegularizationStatus.APPROVED]
                }
            }
        });

        if (currentMonthCount >= maxLimit) {
            return { success: false, error: 'Monthly regularization cap reached.' };
        }

        // 2. Check no existing PENDING or APPROVED regularization for same employee+date
        const existingActive = await prisma.attendanceRegularization.findFirst({
            where: {
                employee_id: data.employeeId,
                organizationId: data.organizationId,
                date: dateOnly,
                status: {
                    in: [RegularizationStatus.PENDING, RegularizationStatus.APPROVED]
                }
            }
        });

        if (existingActive) {
            return {
                success: false,
                error: existingActive.status === RegularizationStatus.PENDING
                    ? 'A regularization request is already pending for this date.'
                    : 'A regularization request has already been approved for this date.'
            };
        }
        // 3. Create AttendanceRegularization
        const regularization = await prisma.attendanceRegularization.create({
            data: {
                employee_id: data.employeeId,
                date: dateOnly,
                type: data.type as RegularizationType,
                reason: data.reason,
                requested_check_in: data.requestedCheckIn || null,
                requested_check_out: data.requestedCheckOut || null,
                status: RegularizationStatus.PENDING,
                organizationId: data.organizationId
            }
        });

        // 4. Create Notification for HR/Admin users
        try {
            const emp = await prisma.employee.findUnique({
                where: { id: data.employeeId }
            });
            const hrUsers = await prisma.user.findMany({
                where: {
                    role: { in: ['hr', 'admin'] },
                    organizationId: data.organizationId,
                    is_active: true
                },
                select: { id: true }
            });

            if (hrUsers.length > 0) {
                await prisma.notification.createMany({
                    data: hrUsers.map(u => ({
                        user_id: u.id,
                        title: 'New Regularization Request',
                        body: `${emp?.name ?? 'An employee'} has submitted a regularization request for ${dateOnly.toLocaleDateString()}.`,
                        type: 'info',
                        link: '/hr/attendance/regularizations',
                        organizationId: data.organizationId
                    }))
                });
            }
        } catch (err) {
            console.error('Error sending HR regularization notification:', err);
        }

        revalidatePath('/ess/regularizations');
        return { success: true, data: regularization };
    } catch (error: any) {
        console.error('Error in submitRegularization:', error);
        return { success: false, error: error.message || 'Failed to submit regularization request' };
    }
}

// ─── FUNCTION 6: reviewRegularization ───
export async function reviewRegularization(data: {
    regularizationId: number;
    action: 'APPROVE' | 'REJECT';
    reviewerId: string;
    rejectionReason?: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Fetch regularization
        const req = await prisma.attendanceRegularization.findUnique({
            where: { id: data.regularizationId },
            include: { employee: true }
        });

        if (!req || req.status !== RegularizationStatus.PENDING) {
            return { success: false, error: 'Regularization request not found or not in PENDING state.' };
        }

        // 2. Verify the reviewer has role "hr" or "admin"
        const reviewer = await prisma.user.findUnique({
            where: { id: data.reviewerId }
        });
        if (reviewer?.role !== 'hr' && reviewer?.role !== 'admin') {
            return { success: false, error: 'Unauthorized' };
        }

        const status = data.action === 'APPROVE' ? RegularizationStatus.APPROVED : RegularizationStatus.REJECTED;

        // 3. Update regularization
        await prisma.attendanceRegularization.update({
            where: { id: data.regularizationId },
            data: {
                status,
                approved_by: parseInt(reviewer.employee_code?.replace('EMP-', '') || '0') || null, // placeholder number or direct linkage if needed, but let's store reviewer employee number or user ID representation. The field is approved_by Int?. Let's try parsing or setting to reviewer's linked profile ID if exists.
                approved_at: new Date(),
                rejection_reason: data.rejectionReason || null
            }
        });

        // 4. If APPROVE:
        if (data.action === 'APPROVE') {
            const dateOnly = getUTCDateOnly(req.date);

            // Upsert Attendance
            const existingAttendance = await prisma.attendance.findFirst({
                where: {
                    employee_id: req.employee_id,
                    organizationId: req.organizationId,
                    date: dateOnly
                }
            });

            // If check_in or check_out is null in requested times, we fall back to existing times
            const finalCheckIn = req.requested_check_in || existingAttendance?.check_in || dateOnly;
            const finalCheckOut = req.requested_check_out || existingAttendance?.check_out || null;

            const attendanceFields = {
                employee_id: req.employee_id,
                date: dateOnly,
                check_in: finalCheckIn,
                check_out: finalCheckOut,
                source: AttendanceSource.MANUAL,
                regularization_id: req.id,
                organizationId: req.organizationId
            };

            if (existingAttendance) {
                await prisma.attendance.update({
                    where: { id: existingAttendance.id },
                    data: attendanceFields
                });
            } else {
                await prisma.attendance.create({
                    data: attendanceFields
                });
            }

            // Create punches for history tracking
            try {
                if (req.requested_check_in) {
                    await prisma.attendancePunch.create({
                        data: {
                            employee_id: req.employee_id,
                            punch_time: req.requested_check_in,
                            source: 'MANUAL',
                            organizationId: req.organizationId
                        }
                    });
                }
                if (req.requested_check_out) {
                    await prisma.attendancePunch.create({
                        data: {
                            employee_id: req.employee_id,
                            punch_time: req.requested_check_out,
                            source: 'MANUAL',
                            organizationId: req.organizationId
                        }
                    });
                }
            } catch (err: any) {
                // Catch duplicates silently
            }

            // Recompute logic
            await processAttendancePunch(req.employee_id, finalCheckIn, req.organizationId);
        }
        // 5. Audit Logging
        await writeAuditLog({
            action: 'REGULARIZATION_' + data.action,
            performedBy: data.reviewerId,
            targetEmployeeId: req.employee_id,
            organizationId: req.organizationId,
            metadata: {
                regularization_id: req.id,
                date: req.date.toISOString(),
                type: req.type,
                reason: req.reason,
                rejection_reason: data.rejectionReason || null
            }
        });

        // 6. Create Notification for the requesting employee
        try {
            if (req.employee?.user_id) {
                const actionLabel = data.action === 'APPROVE' ? 'Approved' : 'Rejected';
                const dateStr = new Date(req.date).toLocaleDateString();
                
                await prisma.notification.create({
                    data: {
                        user_id: req.employee.user_id,
                        title: `Regularization Request ${actionLabel}`,
                        body: `Your regularization request for ${dateStr} has been ${actionLabel.toLowerCase()}.`,
                        type: data.action === 'APPROVE' ? 'success' : 'info',
                        link: '/ess/regularizations',
                        organizationId: req.organizationId
                    }
                });
            }
        } catch (err) {
            console.error('Error sending employee regularization notification:', err);
        }

        revalidatePath('/hr/attendance/regularizations');
        revalidatePath('/ess/regularizations');
        return { success: true };
    } catch (error: any) {
        console.error('Error in reviewRegularization:', error);
        return { success: false, error: error.message || 'Failed to review regularization' };
    }
}

// ─── FUNCTION 7: approveOvertime ───
export async function approveOvertime(
    attendanceId: number,
    approverId: string,
    organizationId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Fetch Attendance record
        const att = await prisma.attendance.findUnique({
            where: { id: attendanceId }
        });

        if (!att || att.organizationId !== organizationId) {
            return { success: false, error: 'Attendance record not found.' };
        }

        if (!att.overtime_minutes || att.overtime_minutes <= 0) {
            return { success: false, error: 'No overtime calculated on this record.' };
        }

        // Set ot_approved = true
        await prisma.attendance.update({
            where: { id: attendanceId },
            data: { ot_approved: true }
        });

        // Log to system_audit_logs
        await writeAuditLog({
            action: 'OVERTIME_APPROVAL',
            performedBy: approverId,
            targetEmployeeId: att.employee_id,
            organizationId,
            metadata: {
                attendance_id: attendanceId,
                date: att.date.toISOString(),
                overtime_minutes: att.overtime_minutes
            }
        });

        revalidatePath('/hr/attendance/overtime');
        return { success: true };
    } catch (error: any) {
        console.error('Error in approveOvertime:', error);
        return { success: false, error: error.message || 'Failed to approve overtime' };
    }
}

// ─── FUNCTION 8: getPendingRegularizations ───
export async function getPendingRegularizations(organizationId: string): Promise<any[]> {
    try {
        return await prisma.attendanceRegularization.findMany({
            where: {
                organizationId,
                status: RegularizationStatus.PENDING
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        employee_code: true,
                        designation: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });
    } catch (error) {
        console.error('Error in getPendingRegularizations:', error);
        return [];
    }
}

// ─── FUNCTION 9: getRegularizationHistory ───
export async function getRegularizationHistory(
    organizationId: string,
    filters: { status?: string; employeeId?: number; month?: number; year?: number }
): Promise<any[]> {
    try {
        const where: any = { organizationId };

        if (filters.status && filters.status !== 'ALL') {
            where.status = filters.status as RegularizationStatus;
        }

        if (filters.employeeId) {
            where.employee_id = filters.employeeId;
        }

        if (filters.month !== undefined && filters.year !== undefined) {
            const startOfMonth = new Date(Date.UTC(filters.year, filters.month - 1, 1, 0, 0, 0, 0));
            const endOfMonth = new Date(Date.UTC(filters.year, filters.month, 0, 23, 59, 59, 999));
            where.date = {
                gte: startOfMonth,
                lte: endOfMonth
            };
        }

        return await prisma.attendanceRegularization.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        employee_code: true,
                        designation: true
                    }
                }
            },
            orderBy: { created_at: 'desc' },
            take: 100
        });
    } catch (error) {
        console.error('Error in getRegularizationHistory:', error);
        return [];
    }
}

// ─── FUNCTION 10: getMyAttendance ───
export async function getMyAttendance(
    employeeId: number,
    month: number,
    year: number
): Promise<any[]> {
    try {
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

        const ctx = await requireTenantContext();
        // ESS data isolation: verify target employee belongs to logged-in user
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId, organizationId: ctx.organizationId }
        });
        if (employee?.user_id !== ctx.session.id) {
            throw new Error('Access denied: Scoped data mismatch.');
        }

        return await prisma.attendance.findMany({
            where: {
                employee_id: employeeId,
                organizationId: ctx.organizationId,
                date: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            },
            orderBy: { date: 'asc' }
        });
    } catch (error) {
        console.error('Error in getMyAttendance:', error);
        return [];
    }
}

// ─── FUNCTION 11: getMyRegularizations ───
export async function getMyRegularizations(employeeId: number): Promise<any[]> {
    try {
        const ctx = await requireTenantContext();
        // ESS data isolation
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId, organizationId: ctx.organizationId }
        });
        if (employee?.user_id !== ctx.session.id) {
            throw new Error('Access denied');
        }

        return await prisma.attendanceRegularization.findMany({
            where: {
                employee_id: employeeId,
                organizationId: ctx.organizationId
            },
            orderBy: { created_at: 'desc' },
            take: 20
        });
    } catch (error) {
        console.error('Error in getMyRegularizations:', error);
        return [];
    }
}

// ─── FUNCTION 12: getAttendanceStats ───
export async function getAttendanceStats(
    organizationId: string,
    month: number,
    year: number
): Promise<{
    present: number;
    absent: number;
    halfDay: number;
    incomplete: number;
    pendingRegularizations: number;
    pendingOT: number;
}> {
    try {
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

        const [present, absent, halfDay, incomplete, pendingRegularizations, pendingOT] = await Promise.all([
            prisma.attendance.count({
                where: {
                    organizationId,
                    date: { gte: startOfMonth, lte: endOfMonth },
                    status: 'Present'
                }
            }),
            prisma.attendance.count({
                where: {
                    organizationId,
                    date: { gte: startOfMonth, lte: endOfMonth },
                    status: 'Absent'
                }
            }),
            prisma.attendance.count({
                where: {
                    organizationId,
                    date: { gte: startOfMonth, lte: endOfMonth },
                    status: 'Half-Day'
                }
            }),
            prisma.attendance.count({
                where: {
                    organizationId,
                    date: { gte: startOfMonth, lte: endOfMonth },
                    status: 'Incomplete'
                }
            }),
            prisma.attendanceRegularization.count({
                where: {
                    organizationId,
                    status: RegularizationStatus.PENDING
                }
            }),
            prisma.attendance.count({
                where: {
                    organizationId,
                    overtime_minutes: { gt: 0 },
                    ot_approved: false
                }
            })
        ]);

        return {
            present,
            absent,
            halfDay,
            incomplete,
            pendingRegularizations,
            pendingOT
        };
    } catch (error) {
        console.error('Error in getAttendanceStats:', error);
        return {
            present: 0,
            absent: 0,
            halfDay: 0,
            incomplete: 0,
            pendingRegularizations: 0,
            pendingOT: 0
        };
    }
}

// ─── FUNCTION 13: getAttendancePolicy ───
export async function getAttendancePolicy(organizationId: string): Promise<any> {
    try {
        let policy = await prisma.attendancePolicy.findUnique({
            where: { organizationId }
        });

        if (!policy) {
            policy = await prisma.attendancePolicy.create({
                data: {
                    organizationId,
                    grace_minutes: 10,
                    late_marks_for_half_day: 3,
                    min_hours_full_day: 8.0,
                    min_hours_half_day: 4.0,
                    sandwich_rule_enabled: false,
                    max_regularizations_month: 3
                }
            });
        }
        return policy;
    } catch (error) {
        console.error('Error in getAttendancePolicy:', error);
        throw error;
    }
}

// ─── FUNCTION 14: updateAttendancePolicy ───
export async function updateAttendancePolicy(
    organizationId: string,
    data: any
): Promise<any> {
    try {
        const ctx = await requireRoleAndTenant(['hr', 'admin']);

        // Strip auto-generated fields to avoid schema errors on save
        const { id, created_at, updated_at, organizationId: omitted, ...cleanData } = data;

        return await prisma.attendancePolicy.upsert({
            where: { organizationId },
            update: cleanData,
            create: {
                organizationId,
                ...cleanData
            }
        });
    } catch (error) {
        console.error('Error in updateAttendancePolicy:', error);
        throw error;
    }
}

// ─── FUNCTION 15: getPunchHistory ───
export async function getPunchHistory(employeeId: number, date: Date): Promise<any[]> {
    try {
        const dateOnly = getUTCDateOnly(date);
        const nextDay = new Date(dateOnly);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);

        const ctx = await requireTenantContext();

        return await prisma.attendancePunch.findMany({
            where: {
                employee_id: employeeId,
                organizationId: ctx.organizationId,
                punch_time: {
                    gte: dateOnly,
                    lt: nextDay
                }
            },
            orderBy: { punch_time: 'asc' }
        });
    } catch (error) {
        console.error('Error in getPunchHistory:', error);
        return [];
    }
}

// ─── FUNCTION 16: getPendingOTApprovals ───
export async function getPendingOTApprovals(organizationId: string): Promise<any[]> {
    try {
        return await prisma.attendance.findMany({
            where: {
                organizationId,
                overtime_minutes: { gt: 0 },
                ot_approved: false
            },
            include: {
                employee: {
                    select: {
                        name: true,
                        employee_code: true,
                        salary_basic: true,
                        grade_band: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });
    } catch (error) {
        console.error('Error in getPendingOTApprovals:', error);
        return [];
    }
}

export async function getHRAttendanceStatsAction(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        const { organizationId } = await requireTenantContext();
        const now = new Date();
        const stats = await getAttendanceStats(organizationId, now.getUTCMonth() + 1, now.getUTCFullYear());
        
        // Count manual entries this month
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
        const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        const manualEntriesCount = await prisma.attendance.count({
            where: {
                organizationId,
                date: { gte: startOfMonth, lte: endOfMonth },
                source: 'MANUAL'
            }
        });
        
        return { success: true, data: { ...stats, manualEntriesCount } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getAttendanceDevicesAction(): Promise<{ success: boolean; data?: any[] }> {
    try {
        const ctx = await requireRoleAndTenant(['hr', 'admin']);
        const devices = await prisma.attendanceDevice.findMany({
            where: { organizationId: ctx.organizationId },
            orderBy: { created_at: 'desc' }
        });
        
        const branches = await prisma.branch.findMany({
            where: { organizationId: ctx.organizationId }
        });
        const branchMap = Object.fromEntries(branches.map(b => [b.id, b.branch_name]));

        const result = devices.map((d: any) => ({
            ...d,
            branchName: d.branch_id ? (branchMap[d.branch_id] || `Branch #${d.branch_id}`) : 'General/Unassigned'
        }));

        return { success: true, data: result };
    } catch (error) {
        console.error('Error in getAttendanceDevicesAction:', error);
        return { success: false, data: [] };
    }
}

export async function createAttendanceDeviceAction(data: {
    device_code: string;
    vendor?: string;
    branch_id?: string;
    webhook_secret: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const ctx = await requireRoleAndTenant(['hr', 'admin']);
        
        const existing = await prisma.attendanceDevice.findUnique({
            where: { device_code: data.device_code }
        });
        if (existing) {
            return { success: false, error: 'Device code already registered.' };
        }

        await prisma.attendanceDevice.create({
            data: {
                device_code: data.device_code,
                vendor: data.vendor || null,
                branch_id: data.branch_id || null,
                webhook_secret: data.webhook_secret,
                organizationId: ctx.organizationId
            }
        });

        revalidatePath('/hr/attendance/devices');
        return { success: true };
    } catch (error: any) {
        console.error('Error in createAttendanceDeviceAction:', error);
        return { success: false, error: error.message || 'Failed to register device' };
    }
}
