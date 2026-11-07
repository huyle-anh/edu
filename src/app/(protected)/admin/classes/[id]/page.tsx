import { requireAuth } from "@/lib/auth";
import { ClassDetailPanel } from "@/modules/class/components/ClassDetailPanel";

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) { await requireAuth(); return <ClassDetailPanel id={(await params).id} />; }
