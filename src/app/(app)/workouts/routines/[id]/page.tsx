"use client";

import { RoutineStatsView } from "@/components/workouts/RoutineStatsView";
import { useParams } from "next/navigation";

export default function RoutineStatsPage() {
  const params = useParams<{ id: string }>();
  return <RoutineStatsView routineId={params.id} />;
}
