import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Shield, HelpCircle, LogOut, MapPin } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const { signOut } = useAuth();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLocalGuide, setIsLocalGuide] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("is_local")
        .eq("user_id", user.id)
        .single();
      
      if (data) {
        setIsLocalGuide(data.is_local || false);
      }
      setLoading(false);
    };
    
    fetchProfile();
  }, [user]);

  const handleLocalGuideToggle = async (checked: boolean) => {
    if (!user) return;
    
    setIsLocalGuide(checked);
    
    const { error } = await supabase
      .from("profiles")
      .update({ is_local: checked })
      .eq("user_id", user.id);
    
    if (error) {
      toast.error("Failed to update preference");
      setIsLocalGuide(!checked);
    } else {
      toast.success(checked ? "You're now visible as a local guide!" : "You're no longer visible as a local guide");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-display font-bold">
          Settings
        </h1>

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
              <MapPin className="w-5 h-5" />
              Local Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="local-guide"
                checked={isLocalGuide}
                onCheckedChange={handleLocalGuideToggle}
                disabled={loading}
                className="mt-1 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
              />
              <div className="space-y-1">
                <Label htmlFor="local-guide" className="font-medium cursor-pointer">
                  I want to be visible as a local tour guide
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, travelers can find you on the match feed to connect with you as a local guide.
                </p>
              </div>
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
