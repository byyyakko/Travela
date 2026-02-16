import AppLayout from "@/components/layout/AppLayout";
import { MessageSquareHeart, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEEDBACK_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdSJzpsXHeVMqX0aJoi4bRbwT-k0Xjj2bzM2YaoySeZLmi_jw/viewform?usp=dialog";

const Feedback = () => {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="bg-secondary border-2 border-primary rounded-full p-4">
          <MessageSquareHeart className="w-10 h-10 text-primary" />
        </div>

        <h1 className="text-2xl font-bold text-foreground">Feedback</h1>

        <p className="text-muted-foreground max-w-md text-base leading-relaxed">
          Thanks for trying out the app!! Please help us fill up this feedback
          form in the meantime!
        </p>

        <Button asChild size="lg" className="gap-2 mt-2">
          <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
            Open Feedback Form
            <ExternalLink className="w-4 h-4" />
          </a>
        </Button>
      </div>
    </AppLayout>
  );
};

export default Feedback;
