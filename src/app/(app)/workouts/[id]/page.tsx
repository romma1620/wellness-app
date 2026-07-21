"use client";

import { WorkoutSessionEditor } from "@/components/workouts/WorkoutSessionEditor";
import { useParams } from "next/navigation";

export default function EditWorkoutPage() {
  const params = useParams<{ id: string }>();
  return <WorkoutSessionEditor workoutId={params.id} />;
}
