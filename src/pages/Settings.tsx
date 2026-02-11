import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Shield, HelpCircle, LogOut, MapPin, Globe } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const { signOut } = useAuth();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage, t, languages } = useLanguage();
  const [isLocalGuide, setIsLocalGuide] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("is_local")
        .eq("user_id", user.id)
        .maybeSingle();
      
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
          {t.settings}
        </h1>

        {/* Language */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="w-5 h-5" />
              {t.language}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={language} onValueChange={(val) => setLanguage(val as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.nativeLabel} ({lang.label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5" />
              {t.notifications}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t.pushNotifications}</Label>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t.emailNotifications}</Label>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t.newMatchAlerts}</Label>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {t.privacy}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t.showOnlineStatus}</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t.showProfileInSearch}</Label>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {t.localGuide}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="local-guide"
                checked={isLocalGuide}
                onCheckedChange={handleLocalGuideToggle}
                disabled={loading}
                className="mt-1"
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

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              {t.support}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="ghost" className="w-full justify-start">
              {t.helpCenter}
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              {t.contactUs}
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              {t.termsOfService}
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              {t.privacyPolicy}
            </Button>
          </CardContent>
        </Card>

        <Button
          variant="destructive"
          className="w-full"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t.signOut}
        </Button>
      </div>
    </AppLayout>
  );
};

export default Settings;
