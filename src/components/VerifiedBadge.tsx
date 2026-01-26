import { BadgeCheck } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VerifiedBadgeProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const VerifiedBadge = ({ className, size = "md" }: VerifiedBadgeProps) => {
  const { theme } = useTheme();

  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <BadgeCheck
          className={cn(
            sizeClasses[size],
            theme === "minimalist" && "text-blue-500",
            theme === "cutesy" && "text-pink-500",
            theme === "anime" && "text-cyan-400",
            className
          )}
        />
      </TooltipTrigger>
      <TooltipContent>
        <p>Verified Local Guide</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default VerifiedBadge;
