import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Bell, Shield, HelpCircle, LogOut } from "lucide-react";

const Settings = () => {
  const { signOut } = useAuth();
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
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold">
            Settings
          </h1>
        </div>

        <Card className="border-pink-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Push Notifications</Label>
              <Switch className="data-[state=checked]:bg-pink-500" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Email Notifications</Label>
              <Switch className="data-[state=checked]:bg-pink-500" />
            </div>
            <div className="flex items-center justify-between">
              <Label>New Match Alerts</Label>
              <Switch defaultChecked className="data-[state=checked]:bg-pink-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-pink-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Show Online Status</Label>
              <Switch defaultChecked className="data-[state=checked]:bg-pink-500" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Profile in Search</Label>
              <Switch defaultChecked className="data-[state=checked]:bg-pink-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-pink-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="ghost" className="w-full justify-start">
              Help Center
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              Contact Us
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              Terms of Service
            </Button>
            <Button variant="ghost" className="w-full justify-start">
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
