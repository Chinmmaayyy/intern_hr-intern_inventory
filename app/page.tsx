import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const redirectMap: Record<string, string> = {
    receptionist: "/reception",
    doctor: "/doctor/dashboard",
    lab_technician: "/lab/technician",
    pharmacist: "/pharmacy/billing",
    admin: "/admin/dashboard",
    finance: "/finance/dashboard",
    ipd_manager: "/ipd",
    nurse: "/nurse/dashboard",
    opd_manager: "/opd-manager/dashboard",
    hr: "/hr/dashboard",
    ot_manager: "/ot/dashboard",
    er_staff: "/er/dashboard",
    store_manager: "/inventory/dashboard",
    procurement_officer: "/inventory/dashboard",
  };

  redirect(redirectMap[session.role] || '/login');
}
