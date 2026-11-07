"use client";

import { useParams, useRouter } from "next/navigation";
import { TuitionEditForm } from "@/modules/finance/tuition/components/TuitionEditForm";

export default function EditTuitionPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();

    return <TuitionEditForm id={params.id} onSuccess={() => router.push(`/admin/tuition-fees/${params.id}`)} />; }
