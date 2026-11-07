import { requireAuth } from "@/lib/auth";
import { ClassList } from "@/modules/class/components/ClassList";
import type { ReactElement } from "react";


export default async function ClassesPage(): Promise<ReactElement> {
  await requireAuth();
  return <ClassList />;
}
