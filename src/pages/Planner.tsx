import { useTheme } from "@/contexts/ThemeContext";
import AppLayout from "@/components/layout/AppLayout";
import CutesyPlanner from "@/components/planner/CutesyPlanner";
import MinimalistPlanner from "@/components/planner/MinimalistPlanner";
import AnimePlanner from "@/components/planner/AnimePlanner";

const Planner = () => {
  const { theme } = useTheme();

  const renderPlannerContent = () => {
    switch (theme) {
      case "cutesy":
        return <CutesyPlanner />;
      case "anime":
        return <AnimePlanner />;
      default:
        return <MinimalistPlanner />;
    }
  };

  return (
    <AppLayout>
      {renderPlannerContent()}
    </AppLayout>
  );
};

export default Planner;
