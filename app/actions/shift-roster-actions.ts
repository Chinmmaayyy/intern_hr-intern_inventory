'use server';

import { requireRoleAndTenant, requireTenantContext } from '@/backend/tenant';
import { revalidatePath } from 'next/cache';

// ========================================
// SHIFT PATTERNS
// ========================================

export async function createShiftPatternV2(data: {
    name: string;
    startTime: string;
    endTime: string;
    shiftCategory?: string;
    isOvernight?: boolean;
    breakMinutes?: number;
    color?: string;
    nightAllowance?: number;
}) {
    try {
        const { db, organizationId } = await requireRoleAndTenant(['admin']);

        await db.shiftPattern.create({
            data: {
                name: data.name,
                start_time: data.startTime,
                end_time: data.endTime,
                shift_category: data.shiftCategory || 'GENERAL',
                is_overnight: data.isOvernight || false,
                break_minutes: data.breakMinutes || 0,
                color: data.color || '#3B82F6',
                night_allowance: data.nightAllowance || 0,
                organizationId,
            },
        });

        revalidatePath('/admin/hr/shifts');
        return { success: true };
    } catch (error) {
        console.error('Create Shift Pattern Error:', error);
        return { success: false, error: 'Failed to create' };
    }
}

export async function updateShiftPattern(id: number, data: any) {
    try {
        const { db } = await requireRoleAndTenant(['admin']);
        await db.shiftPattern.update({
            where: { id },
            data: {
                name: data.name,
                start_time: data.startTime,
                end_time: data.endTime,
                shift_category: data.shiftCategory,
                is_overnight: data.isOvernight,
                break_minutes: data.breakMinutes,
                color: data.color,
                night_allowance: data.nightAllowance,
                is_active: data.isActive,
            },
        });
        revalidatePath('/admin/hr/shifts');
        return { success: true };
    } catch (error) {
        console.error('Update Shift Pattern Error:', error);
        return { success: false, error: 'Failed to update' };
    }
}

export async function getShiftPatternsAdmin() {
    try {
        const { db } = await requireRoleAndTenant(['admin']);
        const patterns = await db.shiftPattern.findMany({ 
            where: { is_active: true },
            orderBy: { name: 'asc' } 
        });
        return { success: true, data: patterns };
    } catch (error) {
        console.error('Get Shift Patterns Error:', error);
        return { success: false, data: [] };
    }
}

// ========================================
// ROSTER ASSIGNMENT & VALIDATION
// ========================================

export async function bulkAssignRoster(data: {
    employeeIds: number[];
    shiftPatternId: number;
    startDate: string;
    endDate: string;
}) {
    try {
        const { db, organizationId } = await requireRoleAndTenant(['admin']);
        
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        const newAssignments = [];
        const errors = [];

        // Pre-fetch relevant data for validation
        const shiftPattern = await db.shiftPattern.findUnique({ where: { id: data.shiftPatternId } });
        if (!shiftPattern) return { success: false, error: 'Shift pattern not found' };

        for (const empId of data.employeeIds) {
            // Check past 6 days prior to startDate to get a true consecutive count
            const past6DaysStart = new Date(start);
            past6DaysStart.setDate(past6DaysStart.getDate() - 6);
            
            const pastAssignments = await db.shiftAssignment.findMany({
                where: { 
                    employee_id: empId, 
                    date: { gte: past6DaysStart, lt: start } 
                },
                orderBy: { date: 'asc' }
            });

            // Calculate initial consecutive days leading up to the start date
            let consecutiveDays = 0;
            for(let i = 0; i < 6; i++) {
                const checkDateStr = format(addDays(past6DaysStart, i), 'yyyy-MM-dd');
                const hasShift = pastAssignments.some(a => format(new Date(a.date), 'yyyy-MM-dd') === checkDateStr);
                if(hasShift) consecutiveDays++;
                else consecutiveDays = 0; // reset if there's a gap
            }

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const currentDate = new Date(d);
                
                // REST RULE: Prevent more than 6 consecutive days
                if (consecutiveDays >= 6) {
                    errors.push(`Employee ${empId} cannot be assigned on ${currentDate.toDateString()} because it exceeds 6 consecutive working days.`);
                    consecutiveDays = 0; // reset for next simulation
                    continue;
                }
                consecutiveDays++; // Optimistically count this new assignment

                // FATIGUE MANAGEMENT: If worked > 11.5 hours yesterday, ensure 12 hour gap.
                const prevDate = new Date(currentDate);
                prevDate.setDate(prevDate.getDate() - 1);

                const prevAttendance = await db.attendance.findFirst({
                    where: { employee_id: empId, date: prevDate }
                });

                if (prevAttendance && prevAttendance.total_hours && prevAttendance.total_hours >= 11.5) {
                    if (prevAttendance.check_out && shiftPattern.start_time) {
                        const newShiftStart = new Date(currentDate);
                        const [hours, mins] = shiftPattern.start_time.split(':').map(Number);
                        newShiftStart.setHours(hours, mins, 0, 0);

                        const hoursSinceLastCheckout = (newShiftStart.getTime() - prevAttendance.check_out.getTime()) / (1000 * 60 * 60);
                        if (hoursSinceLastCheckout < 12) {
                            errors.push(`Employee ${empId} cannot start shift on ${currentDate.toDateString()} at ${shiftPattern.start_time}. They worked a 12+ hour shift ending at ${prevAttendance.check_out.toLocaleTimeString()} yesterday. Mandatory 12 hour rest required.`);
                            continue;
                        }
                    }
                }
                
                // REST RULE: Prevent Morning after Night shift
                if (shiftPattern.shift_category === 'MORNING') {
                    const prevDate = new Date(currentDate);
                    prevDate.setDate(prevDate.getDate() - 1);
                    
                    const prevShift = await db.shiftAssignment.findFirst({
                        where: { employee_id: empId, date: prevDate },
                        include: { shift_pattern: true }
                    });
                    
                    if (prevShift && prevShift.shift_pattern.shift_category === 'NIGHT') {
                        errors.push(`Employee ${empId} cannot be assigned MORNING on ${currentDate.toDateString()} after a NIGHT shift.`);
                        continue;
                    }
                }
                
                // If no errors, prepare assignment
                newAssignments.push({
                    employee_id: empId,
                    shift_pattern_id: data.shiftPatternId,
                    date: currentDate,
                    organizationId,
                });
            }
        }

        if (errors.length > 0) {
            return { success: false, error: 'Validation failed', validationErrors: errors };
        }

        // Upsert to handle unique constraint safely
        let count = 0;
        for (const assignment of newAssignments) {
            await db.shiftAssignment.upsert({
                where: {
                    employee_id_date_organizationId: {
                        employee_id: assignment.employee_id,
                        date: assignment.date,
                        organizationId,
                    }
                },
                update: {
                    shift_pattern_id: assignment.shift_pattern_id,
                    status: 'ASSIGNED'
                },
                create: assignment
            });
            count++;
        }

        revalidatePath('/admin/hr/roster');
        return { success: true, count };
    } catch (error) {
        console.error('Bulk Assign Roster Error:', error);
        return { success: false, error: 'Failed to assign roster' };
    }
}

export async function getRosterForRange(startDate: string, endDate: string) {
    try {
        const { db } = await requireRoleAndTenant(['admin']);
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const assignments = await db.shiftAssignment.findMany({
            where: { date: { gte: start, lte: end } },
            include: {
                employee: { select: { name: true, employee_code: true, designation: true, department_id: true } },
                shift_pattern: true,
            },
            orderBy: [{ date: 'asc' }, { employee: { name: 'asc' } }],
        });
        return { success: true, data: assignments };
    } catch (error) {
        console.error('Get Roster Error:', error);
        return { success: false, data: [] };
    }
}

// ========================================
// SHIFT SWAP WORKFLOW
// ========================================

export async function requestShiftSwap(requesterAssignmentId: number, targetAssignmentId: number) {
    try {
        const { db, organizationId } = await requireTenantContext(); 
        
        const reqAssign = await db.shiftAssignment.findUnique({ where: { id: requesterAssignmentId }});
        const targetAssign = await db.shiftAssignment.findUnique({ where: { id: targetAssignmentId }});
        
        if(!reqAssign || !targetAssign) return { success: false, error: 'Assignments not found' };

        await db.shiftSwapRequest.create({
            data: {
                requester_assignment_id: requesterAssignmentId,
                target_assignment_id: targetAssignmentId,
                requester_employee_id: reqAssign.employee_id,
                target_employee_id: targetAssign.employee_id,
                organizationId
            }
        });
        
        return { success: true };
    } catch(error) {
        console.error(error);
        return { success: false, error: 'Failed to create request' };
    }
}

export async function getSwapRequestsAdmin() {
    try {
        const { db } = await requireRoleAndTenant(['admin']);
        const requests = await db.shiftSwapRequest.findMany({
            include: {
                organization: false
            },
            orderBy: { created_at: 'desc' }
        });

        const enhancedRequests = await Promise.all(requests.map(async (req) => {
            const reqAssign = await db.shiftAssignment.findUnique({ 
                where: { id: req.requester_assignment_id },
                include: { employee: true, shift_pattern: true }
            });
            const targetAssign = await db.shiftAssignment.findUnique({ 
                where: { id: req.target_assignment_id },
                include: { employee: true, shift_pattern: true }
            });
            return {
                ...req,
                requesterAssignment: reqAssign,
                targetAssignment: targetAssign
            };
        }));
        
        return { success: true, data: enhancedRequests };
    } catch (error) {
        console.error('Get Swaps Error:', error);
        return { success: false, data: [] };
    }
}

export async function adminApproveSwap(swapId: number, approvedBy: string) {
    try {
        const { db } = await requireRoleAndTenant(['admin']);
        
        const swap = await db.shiftSwapRequest.findUnique({ where: { id: swapId }});
        if(!swap) return { success: false, error: 'Not found' };
        
        // Swap actual assignments
        const reqAssign = await db.shiftAssignment.findUnique({ where: { id: swap.requester_assignment_id }});
        const targetAssign = await db.shiftAssignment.findUnique({ where: { id: swap.target_assignment_id }});
        
        if(reqAssign && targetAssign) {
            await db.$transaction([
                db.shiftAssignment.update({
                    where: { id: reqAssign.id },
                    data: { employee_id: targetAssign.employee_id }
                }),
                db.shiftAssignment.update({
                    where: { id: targetAssign.id },
                    data: { employee_id: reqAssign.employee_id }
                }),
                db.shiftSwapRequest.update({
                    where: { id: swapId },
                    data: { status: 'ADMIN_APPROVED', approved_by: approvedBy, approved_at: new Date() }
                })
            ]);
        }
        
        revalidatePath('/admin/hr/swaps');
        return { success: true };
    } catch (error) {
        console.error('Approve Swap Error:', error);
        return { success: false, error: 'Failed to approve swap' };
    }
}

// ========================================
// HOLIDAYS & COVERAGE RULES (CRUD)
// ========================================

export async function getHolidaysAdmin() {
    try {
        const { db } = await requireRoleAndTenant(['admin']);
        const holidays = await db.holiday.findMany({ orderBy: { date: 'asc' } });
        return { success: true, data: holidays };
    } catch (error) {
        return { success: false, data: [] };
    }
}

export async function createHoliday(data: { name: string; date: string; type: string; isOptional: boolean }) {
    try {
        const { db, organizationId } = await requireRoleAndTenant(['admin']);
        await db.holiday.create({
            data: {
                name: data.name,
                date: new Date(data.date),
                type: data.type,
                is_optional: data.isOptional,
                organizationId
            }
        });
        revalidatePath('/admin/hr/holidays');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to create holiday' };
    }
}

export async function getCoverageRules() {
    try {
        const { db } = await requireRoleAndTenant(['admin']);
        const rules = await db.coverageRule.findMany({
            include: { shift_pattern: true },
            orderBy: { created_at: 'desc' }
        });
        const depts = await db.department.findMany();
        const deptMap = Object.fromEntries(depts.map((d: any) => [d.id, d.name]));
        
        const enhanced = rules.map((r: any) => ({
            ...r,
            department_name: deptMap[r.department_id] || 'Unknown'
        }));
        
        return { success: true, data: enhanced };
    } catch (error) {
        return { success: false, data: [] };
    }
}

export async function createCoverageRule(data: { departmentId: string; shiftPatternId: number; designation?: string; minStaff: number }) {
    try {
        const { db, organizationId } = await requireRoleAndTenant(['admin']);
        await db.coverageRule.create({
            data: {
                department_id: data.departmentId,
                shift_pattern_id: data.shiftPatternId,
                designation: data.designation || null,
                min_staff: data.minStaff,
                organizationId
            }
        });
        revalidatePath('/admin/hr/coverage');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to create coverage rule' };
    }
}

// Validation function exposed for pre-save or UI feedback
export async function validateRosterCoverage(startDate: string, endDate: string) {
    try {
        const { db } = await requireRoleAndTenant(['admin']);
        const rules = await db.coverageRule.findMany({ where: { is_active: true } });
        const assignments = await getRosterForRange(startDate, endDate);
        
        if (!assignments.success) return { success: false, error: 'Failed to fetch roster' };
        
        const errors: string[] = [];
        
        // Complex coverage logic can go here. For demo, we just return empty errors if fine.
        // In real app, we group by date -> department -> pattern and count against minStaff
        
        return { success: true, validationErrors: errors };
    } catch(err) {
        return { success: false, error: 'Coverage validation failed' };
    }
}

// ========================================
// SHIFT SWAP HELPERS
// ========================================

export async function getEmployeeShiftAssignments(userId: string) {
    try {
        const { db, organizationId } = await requireTenantContext();
        const employee = await db.employee.findUnique({ where: { user_id: userId } });
        if (!employee) return { success: false, error: 'Employee record not found for user' };
        
        const assignments = await db.shiftAssignment.findMany({
            where: { 
                employee_id: employee.id, 
                organizationId,
                date: { gte: new Date() }
            },
            include: { shift_pattern: true },
            orderBy: { date: 'asc' }
        });
        return { success: true, data: assignments };
    } catch (error) {
        console.error('Error fetching assignments:', error);
        return { success: false, data: [] };
    }
}

export async function getEligibleSwapTargets() {
    try {
        const { db, organizationId } = await requireTenantContext();
        const employees = await db.employee.findMany({
            where: { is_active: true, organizationId },
            select: { id: true, name: true, designation: true, department_id: true }
        });
        return { success: true, data: employees };
    } catch (error) {
        console.error('Error fetching employees:', error);
        return { success: false, data: [] };
    }
}

export async function getTargetEmployeeAssignments(employeeId: number) {
    try {
        const { db, organizationId } = await requireTenantContext();
        const assignments = await db.shiftAssignment.findMany({
            where: {
                employee_id: employeeId,
                organizationId,
                date: { gte: new Date() }
            },
            include: { shift_pattern: true },
            orderBy: { date: 'asc' }
        });
        return { success: true, data: assignments };
    } catch (error) {
        console.error('Error fetching target assignments:', error);
        return { success: false, data: [] };
    }
}

export async function adminRejectSwap(swapId: number, adminNotes?: string) {
    try {
        const { db } = await requireRoleAndTenant(['admin']);
        await db.shiftSwapRequest.update({
            where: { id: swapId },
            data: {
                status: 'REJECTED',
                admin_notes: adminNotes,
                responded_at: new Date(),
            }
        });
        revalidatePath('/admin/hr/swaps');
        return { success: true };
    } catch (error) {
        console.error('Error rejecting swap:', error);
        return { success: false, error: 'Failed to reject swap' };
    }
}

export async function getMySwapRequests(userId: string) {
    try {
        const { db } = await requireTenantContext();
        const employee = await db.employee.findUnique({ where: { user_id: userId } });
        if (!employee) return { success: false, data: [] };

        const requests = await db.shiftSwapRequest.findMany({
            where: {
                OR: [
                    { requester_employee_id: employee.id },
                    { target_employee_id: employee.id }
                ]
            },
            orderBy: { created_at: 'desc' }
        });

        const enhancedRequests = await Promise.all(requests.map(async (req) => {
            const reqAssign = await db.shiftAssignment.findUnique({
                where: { id: req.requester_assignment_id },
                include: { employee: true, shift_pattern: true }
            });
            const targetAssign = await db.shiftAssignment.findUnique({
                where: { id: req.target_assignment_id },
                include: { employee: true, shift_pattern: true }
            });
            return {
                ...req,
                requesterAssignment: reqAssign,
                targetAssignment: targetAssign
            };
        }));

        return { success: true, data: enhancedRequests };
    } catch (error) {
        console.error('Error fetching my swap requests:', error);
        return { success: false, data: [] };
    }
}

export async function requestShiftSwapGeneric(userId: string, targetEmployeeId: number, giveDate: string, givePatternName: string, takeDate: string, takePatternName: string) {
    try {
        const { db, organizationId } = await requireTenantContext();
        const employee = await db.employee.findUnique({ where: { user_id: userId } });
        if (!employee) return { success: false, error: 'User not found' };

        // Helper to find or create ShiftAssignment
        async function getOrCreateAssignment(empId: number, dateStr: string, patternName: string) {
            const date = new Date(dateStr);
            let assignment = await db.shiftAssignment.findFirst({
                where: { employee_id: empId, date }
            });
            if (assignment) {
                return assignment;
            }

            let pattern = await db.shiftPattern.findFirst({ where: { name: patternName, organizationId } });
            if (!pattern) {
                pattern = await db.shiftPattern.create({
                    data: { name: patternName, start_time: '08:00', end_time: '16:00', organizationId }
                });
            }
            assignment = await db.shiftAssignment.create({
                data: { employee_id: empId, date, shift_pattern_id: pattern.id, organizationId }
            });
            return assignment;
        }

        const myAssignment = await getOrCreateAssignment(employee.id, giveDate, givePatternName);
        const targetAssignment = await getOrCreateAssignment(targetEmployeeId, takeDate, takePatternName);

        await db.shiftSwapRequest.create({
            data: {
                requester_employee_id: employee.id,
                target_employee_id: targetEmployeeId,
                requester_assignment_id: myAssignment.id,
                target_assignment_id: targetAssignment.id,
                organizationId
            }
        });
        return { success: true };
    } catch (e: any) {
        console.error(e);
        return { success: false, error: 'Failed to create generic swap: ' + (e.message || String(e)) };
    }
}

