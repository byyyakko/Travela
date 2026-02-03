import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

// Primary navigation routes where back button is not needed
const PRIMARY_NAV_ROUTES = ["/home", "/match", "/planner", "/messages", "/profile"];

interface BackButtonProps {
  className?: string;
  fallbackPath?: string;
}

const BackButton = ({ className, fallbackPath = "/home" }: BackButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on primary navigation routes
  const isPrimaryRoute = PRIMARY_NAV_ROUTES.includes(location.pathname);
  
  if (isPrimaryRoute) {
    return null;
  }

  const handleBack = () => {
    // Check if there's history to go back to
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleBack}
      className={className}
      aria-label="Go back"
    >
      <ArrowLeft className="w-5 h-5" />
    </Button>
  );
};

export default BackButton;
