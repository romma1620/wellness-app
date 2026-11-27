import { oriSrc, type OriPose } from "@/lib/mascot";
import { cn } from "@/lib/utils";

/** Маскот Орі. Декоративний: усе, що він «каже», дублюється текстом поруч. */
export function Ori({ pose, size, className }: { pose: OriPose; size: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- статичний SVG, оптимізація не потрібна
    <img
      src={oriSrc(pose)}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Орі з короткою реплікою: заголовок і підрядок праворуч.
 * `lg` — шапка екрана (привітання, підсумок інсайтів), `sm` — рядок у картці.
 */
export function OriMessage({
  pose,
  title,
  text,
  size = "lg",
  className,
}: {
  pose: OriPose;
  title: string;
  text: string;
  size?: "lg" | "sm";
  className?: string;
}) {
  const lg = size === "lg";
  return (
    <div className={cn("flex items-center", lg ? "gap-3" : "gap-[10px]", className)}>
      <Ori pose={pose} size={lg ? 64 : 44} />
      <div className="min-w-0">
        <p className={cn("font-semibold leading-tight", lg ? "text-[17px]" : "text-[13.5px]")}>
          {title}
        </p>
        <p className={cn("mt-[3px] text-muted", lg ? "text-[13px]" : "text-[12px]")}>{text}</p>
      </div>
    </div>
  );
}
