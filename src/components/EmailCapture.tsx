import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const EmailCapture = () => {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from("waitlist_emails")
        .upsert({ email: trimmed }, { onConflict: "email" });
      if (error) {
        toast({ title: "Couldn't save your email", description: error.message, variant: "destructive" });
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-16 bg-primary/5">
      <div className="container mx-auto px-6 text-center max-w-xl">
        <h2 className="text-2xl font-bold mb-2">Stay in the loop</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Get travel tips and early access updates — no spam, ever.
        </p>

        {done ? (
          <p className="text-primary font-semibold text-lg">You're on the list! ✈️</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm mx-auto">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1"
            />
            <Button type="submit" disabled={loading} className="h-11 px-5">
              {loading ? "..." : "Join"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
};

export default EmailCapture;
