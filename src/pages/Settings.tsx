import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Bell, Shield, Palette, HelpCircle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const Settings = () => {
  const { signOut } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className={cn(
              theme === "anime" && "text-purple-300 hover:text-white"
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className={cn(
            "text-2xl font-display font-bold",
            theme === "anime" && "text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-400"
          )}>
            Settings
          </h1>
        </div>

        <Card className={cn(
          theme === "cutesy" && "border-pink-200",
          theme === "anime" && "border-purple-500/30 bg-purple-900/50"
        )}>
          <CardHeader>
            <CardTitle className={cn(
              "text-lg flex items-center gap-2",
              theme === "anime" && "text-white"
            )}>
              <Bell className="w-5 h-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className={theme === "anime" ? "text-purple-200" : ""}>Push Notifications</Label>
              <Switch className={cn(
                theme === "cutesy" && "data-[state=checked]:bg-pink-500",
                theme === "anime" && "data-[state=checked]:bg-cyan-500"
              )} />
            </div>
            <div className="flex items-center justify-between">
              <Label className={theme === "anime" ? "text-purple-200" : ""}>Email Notifications</Label>
              <Switch className={cn(
                theme === "cutesy" && "data-[state=checked]:bg-pink-500",
                theme === "anime" && "data-[state=checked]:bg-cyan-500"
              )} />
            </div>
            <div className="flex items-center justify-between">
              <Label className={theme === "anime" ? "text-purple-200" : ""}>New Match Alerts</Label>
              <Switch defaultChecked className={cn(
                theme === "cutesy" && "data-[state=checked]:bg-pink-500",
                theme === "anime" && "data-[state=checked]:bg-cyan-500"
              )} />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          theme === "cutesy" && "border-pink-200",
          theme === "anime" && "border-purple-500/30 bg-purple-900/50"
        )}>
          <CardHeader>
            <CardTitle className={cn(
              "text-lg flex items-center gap-2",
              theme === "anime" && "text-white"
            )}>
              <Shield className="w-5 h-5" />
              Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className={theme === "anime" ? "text-purple-200" : ""}>Show Online Status</Label>
              <Switch defaultChecked className={cn(
                theme === "cutesy" && "data-[state=checked]:bg-pink-500",
                theme === "anime" && "data-[state=checked]:bg-cyan-500"
              )} />
            </div>
            <div className="flex items-center justify-between">
              <Label className={theme === "anime" ? "text-purple-200" : ""}>Show Profile in Search</Label>
              <Switch defaultChecked className={cn(
                theme === "cutesy" && "data-[state=checked]:bg-pink-500",
                theme === "anime" && "data-[state=checked]:bg-cyan-500"
              )} />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          theme === "cutesy" && "border-pink-200",
          theme === "anime" && "border-purple-500/30 bg-purple-900/50"
        )}>
          <CardHeader>
            <CardTitle className={cn(
              "text-lg flex items-center gap-2",
              theme === "anime" && "text-white"
            )}>
              <Palette className="w-5 h-5" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start",
                theme === "cutesy" && "border-pink-200",
                theme === "anime" && "border-purple-500/30 text-purple-300"
              )}
              onClick={() => navigate("/profile")}
            >
              Change Theme
            </Button>
          </CardContent>
        </Card>

        <Card className={cn(
          theme === "cutesy" && "border-pink-200",
          theme === "anime" && "border-purple-500/30 bg-purple-900/50"
        )}>
          <CardHeader>
            <CardTitle className={cn(
              "text-lg flex items-center gap-2",
              theme === "anime" && "text-white"
            )}>
              <HelpCircle className="w-5 h-5" />
              Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start",
                theme === "anime" && "text-purple-300 hover:text-white"
              )}
            >
              Help Center
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start",
                theme === "anime" && "text-purple-300 hover:text-white"
              )}
            >
              Contact Us
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start",
                theme === "anime" && "text-purple-300 hover:text-white"
              )}
            >
              Terms of Service
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start",
                theme === "anime" && "text-purple-300 hover:text-white"
              )}
            >
              Privacy Policy
            </Button>
          </CardContent>
        </Card>

        <Button
          variant="destructive"
          className="w-full"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </AppLayout>
  );
};

export default Settings;
