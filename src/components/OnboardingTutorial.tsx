import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import mascotImg from "@/assets/mascot-cutesy.png";
import { X } from "lucide-react";

const tutorialSteps = [
  {
    selector: '[data-tour="home"]',
    title: "Home 🏠",
    message: "Welcome to Travela! This is your Home feed~ See posts from other travelers and locals, share your adventures, and stay connected! ✨",
  },
  {
    selector: '[data-tour="explore"]',
    title: "Explore 🧭",
    message: "Discover amazing local experiences here! From food tours to city walks, find unique activities hosted by real locals~ 🌸",
  },
  {
    selector: '[data-tour="for-you"]',
    title: "For You ✨",
    message: "This is your personalized feed! I'll recommend circles and experiences based on your interests and travel plans~ Super smart, right? 🧠",
  },
  {
    selector: '[data-tour="ask-local"]',
    title: "Ask a Local 🌍",
    message: "Want to connect with local guides? Browse verified locals in your destination and send them a connection request! 🤝",
  },
  {
    selector: '[data-tour="plan"]',
    title: "Trip Planner 📅",
    message: "Plan your dream trips here! Create itineraries, add activities day by day, and even get AI-powered suggestions~ 🗺️",
  },
  {
    selector: '[data-tour="chat"]',
    title: "Messages 💬",
    message: "Chat with your matches, local guides, and travel buddies! All your conversations live here~ 📨",
  },
  {
    selector: '[data-tour="circles"]',
    title: "Circles 🔵",
    message: "Join interest-based groups! Find circles for foodies, hikers, photographers and more. You can even organize meetups! 🎉",
  },
  {
    selector: '[data-tour="toilet"]',
    title: "Toilet Finder 🚻",
    message: "A traveler's best friend! Find nearby public restrooms wherever you are~ Trust me, you'll thank me later! 😄",
  },
  {
    selector: '[data-tour="profile"]',
    title: "Your Profile 👤",
    message: "This is YOU! Edit your profile, add photos, set your interests, and manage your travel preferences here~ Make it cute! 💖",
  },
];

interface OnboardingTutorialProps {
  forceShow?: boolean;
  onComplete?: () => void;
}

const OnboardingTutorial = ({ forceShow = false, onComplete }: OnboardingTutorialProps) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [show, setShow] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; arrowSide: "top" | "bottom" | "left" | "right" }>({ top: 0, left: 0, arrowSide: "bottom" });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forceShow) {
      setShow(true);
      setCurrentStep(0);
      return;
    }

    const checkTutorial = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("has_seen_tutorial")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data && !data.has_seen_tutorial) {
        setShow(true);
      }
    };
    checkTutorial();
  }, [user, forceShow]);

  useEffect(() => {
    if (!show) return;

    const step = tutorialSteps[currentStep];
    const el = document.querySelector(step.selector);
    if (!el) return;

    // Scroll element into view
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Add highlight
    el.classList.add("tutorial-highlight");

    const updatePosition = () => {
      const rect = el.getBoundingClientRect();
      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        // Position tooltip above the bottom nav
        setTooltipPos({
          top: rect.top - 180,
          left: Math.max(16, Math.min(rect.left + rect.width / 2 - 150, window.innerWidth - 316)),
          arrowSide: "bottom",
        });
      } else {
        // Position tooltip to the right of sidebar items
        setTooltipPos({
          top: Math.max(16, rect.top - 20),
          left: rect.right + 16,
          arrowSide: "left",
        });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);

    return () => {
      el.classList.remove("tutorial-highlight");
      window.removeEventListener("resize", updatePosition);
    };
  }, [show, currentStep]);

  const completeTutorial = async () => {
    setShow(false);
    onComplete?.();
    if (!user || forceShow) return;

    await supabase
      .from("profiles")
      .update({ has_seen_tutorial: true } as any)
      .eq("user_id", user.id);
  };

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTutorial();
    }
  };

  const handleSkip = () => {
    completeTutorial();
  };

  if (!show) return null;

  const step = tutorialSteps[currentStep];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={handleSkip} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[9999] w-[300px] animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        <div className="bg-card border-2 border-primary rounded-2xl p-4 shadow-xl relative">
          {/* Close button */}
          <button onClick={handleSkip} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>

          {/* Tori-Tan header */}
          <div className="flex items-center gap-2 mb-2">
            <img src={mascotImg} alt="Tori-Tan" className="w-10 h-10 object-contain" />
            <div>
              <p className="text-xs font-bold text-primary">Tori-Tan</p>
              <p className="text-sm font-bold text-foreground">{step.title}</p>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {step.message}
          </p>

          {/* Progress & actions */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {tutorialSteps.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentStep ? "bg-primary" : i < currentStep ? "bg-primary/40" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-xs">
                Skip
              </Button>
              <Button size="sm" onClick={handleNext} className="text-xs">
                {currentStep === tutorialSteps.length - 1 ? "Done! 🎉" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingTutorial;
