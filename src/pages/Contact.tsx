import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { MapPin, Mail, Send, CheckCircle } from "lucide-react";

const Contact = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setLoading(true);
    const { error } = await (supabase as any)
      .from("contact_submissions")
      .insert({ name: name.trim(), email: email.trim(), message: message.trim() });
    setLoading(false);

    if (error) {
      toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
      return;
    }

    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Simple nav */}
      <nav className="border-b px-6 py-4 flex items-center gap-2">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <MapPin className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">Travela</span>
        </a>
      </nav>

      <div className="container max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Get in Touch</h1>
        <p className="text-muted-foreground mb-10">
          Have a question, partnership idea, or just want to say hi? We'd love to hear from you.
        </p>

        {submitted ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <h2 className="text-xl font-semibold">Message sent!</h2>
              <p className="text-muted-foreground">We'll get back to you as soon as we can.</p>
              <Button variant="outline" onClick={() => { setSubmitted(false); setName(""); setEmail(""); setMessage(""); }}>
                Send another message
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's on your mind?"
                rows={5}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              <Send className="w-4 h-4 mr-2" />
              {loading ? "Sending..." : "Send Message"}
            </Button>
          </form>
        )}

        {/* Direct contact info */}
        <div className="mt-12 pt-8 border-t space-y-3">
          <p className="text-sm text-muted-foreground font-medium">Or reach us directly:</p>
          <a
            href="mailto:travelatheworld1123@gmail.com"
            className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
          >
            <Mail className="w-4 h-4" />
            travelatheworld1123@gmail.com
          </a>
          <a
            href="https://www.instagram.com/travelayourway"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
            @travelayourway
          </a>
        </div>
      </div>
    </div>
  );
};

export default Contact;
