import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import mascotImage from "@/assets/mascot-cutesy.png";

const EmailVerified = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-card">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: 'hsl(var(--logo-bg))' }}>
              <img src={mascotImage} alt="Tori-Tan" className="w-12 h-12 object-contain" />
            </div>
          </div>

          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-display font-bold text-foreground">
              Success!
            </h1>
            <p className="text-muted-foreground">
              Your email has been verified.
            </p>
          </div>

          <Button onClick={() => navigate("/auth")} className="w-full" size="lg">
            Click to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailVerified;
