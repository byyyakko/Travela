import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const DEMO_CONVERSATIONS = [
  {
    id: "demo-conv-1",
    participant1_id: "current-user",
    participant2_id: "demo-user-1",
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    otherUser: {
      display_name: "Mei Lin",
      avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    },
    lastMessage: {
      content: "Yes! The hawker center on Smith Street is the best 🍜",
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
  },
  {
    id: "demo-conv-2",
    participant1_id: "current-user",
    participant2_id: "demo-user-2",
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    otherUser: {
      display_name: "Haruki",
      avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    },
    lastMessage: {
      content: "I'll send you the address of that izakaya! It's in Shimokitazawa",
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    id: "demo-conv-3",
    participant1_id: "current-user",
    participant2_id: "demo-user-3",
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    otherUser: {
      display_name: "Amara",
      avatar_url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop&crop=face",
    },
    lastMessage: {
      content: "The sunrise surf session was incredible! Let's do it again tomorrow 🏄‍♀️",
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    id: "demo-conv-4",
    participant1_id: "current-user",
    participant2_id: "demo-user-4",
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    otherUser: {
      display_name: "Sofia",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    },
    lastMessage: {
      content: "Definitely try the patatas bravas at Cal Pep — you won't regret it!",
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
];

const DEMO_MESSAGES: Record<string, Message[]> = {
  "demo-conv-1": [
    { id: "m1", content: "Hey Mei Lin! I just arrived in Singapore. Any food recommendations?", sender_id: "current-user", created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), read: true },
    { id: "m2", content: "Welcome!! 🎉 You HAVE to try the chicken rice at Tian Tian in Maxwell Food Centre", sender_id: "demo-user-1", created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(), read: true },
    { id: "m3", content: "That sounds amazing! Is it crowded?", sender_id: "current-user", created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(), read: true },
    { id: "m4", content: "Go before 11am to avoid the queue. Trust me on this one 😄", sender_id: "demo-user-1", created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), read: true },
    { id: "m5", content: "Got it! Any other hidden gems?", sender_id: "current-user", created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(), read: true },
    { id: "m6", content: "Yes! The hawker center on Smith Street is the best 🍜", sender_id: "demo-user-1", created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), read: true },
  ],
  "demo-conv-2": [
    { id: "m7", content: "Haruki! Your ramen post made me so hungry 😭", sender_id: "current-user", created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), read: true },
    { id: "m8", content: "Haha! You should come to Tokyo then 🍜", sender_id: "demo-user-2", created_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(), read: true },
    { id: "m9", content: "Actually I'm planning a trip next month! Any must-visit spots?", sender_id: "current-user", created_at: new Date(Date.now() - 2.3 * 60 * 60 * 1000).toISOString(), read: true },
    { id: "m10", content: "I'll send you the address of that izakaya! It's in Shimokitazawa", sender_id: "demo-user-2", created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), read: true },
  ],
  "demo-conv-3": [
    { id: "m11", content: "Hi Amara! I saw you offer surf lessons in Bali?", sender_id: "current-user", created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), read: true },
    { id: "m12", content: "Yes! I teach at Canggu beach every morning at 6am 🌊", sender_id: "demo-user-3", created_at: new Date(Date.now() - 25.5 * 60 * 60 * 1000).toISOString(), read: true },
    { id: "m13", content: "That sounds perfect. I'm a total beginner though!", sender_id: "current-user", created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), read: true },
    { id: "m14", content: "No worries, everyone starts somewhere! I'll take care of you 😊", sender_id: "demo-user-3", created_at: new Date(Date.now() - 24.5 * 60 * 60 * 1000).toISOString(), read: true },
    { id: "m15", content: "The sunrise surf session was incredible! Let's do it again tomorrow 🏄‍♀️", sender_id: "demo-user-3", created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), read: true },
  ],
  "demo-conv-4": [
    { id: "m16", content: "Sofia! I'm heading to Barcelona next week. Tapas tips?", sender_id: "current-user", created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), read: true },
    { id: "m17", content: "Skip La Rambla!! Go to El Born neighborhood instead 🇪🇸", sender_id: "demo-user-4", created_at: new Date(Date.now() - 3.8 * 24 * 60 * 60 * 1000).toISOString(), read: true },
    { id: "m18", content: "Definitely try the patatas bravas at Cal Pep — you won't regret it!", sender_id: "demo-user-4", created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), read: true },
  ],
};

interface Conversation {
  id: string;
  participant1_id: string;
  participant2_id: string;
  updated_at: string;
  otherUser?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  lastMessage?: {
    content: string;
    created_at: string;
  };
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  read: boolean;
}

const Messages = () => {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Fetch other user profiles and last messages
      const enrichedConversations: Conversation[] = await Promise.all(
        (data || []).map(async (conv) => {
          const otherUserId = conv.participant1_id === user.id 
            ? conv.participant2_id 
            : conv.participant1_id;

          const { data: profileData } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("user_id", otherUserId)
            .maybeSingle();

          const { data: lastMsgData } = await supabase
            .from("messages")
            .select("content, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...conv,
            otherUser: profileData || undefined,
            lastMessage: lastMsgData || undefined,
          };
        })
      );

      return enrichedConversations;
    },
    enabled: !!user,
  });

  const isDemo = selectedConversation?.id.startsWith("demo-");

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    // If it's a demo conversation, use the demo messages
    if (selectedConversation.id.startsWith("demo-")) {
      const userId = user?.id || "current-user";
      const demoMsgs = DEMO_MESSAGES[selectedConversation.id] || [];
      // Replace "current-user" sender_id with actual user id for display
      setMessages(demoMsgs.map(m => ({
        ...m,
        sender_id: m.sender_id === "current-user" ? userId : m.sender_id,
      })));
      return;
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConversation.id)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${selectedConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedConversation.id,
      sender_id: user.id,
      content: newMessage.trim(),
    });

    if (!error) {
      setNewMessage("");
    }
  };

  if (selectedConversation) {
    return (
      <AppLayout>
        <Card className="h-[calc(100vh-12rem)] flex flex-col border-primary/30">
          {/* Chat header */}
          <div className="p-4 border-b border-primary/30 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedConversation(null)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Avatar className="ring-2 ring-primary/30">
              <AvatarImage src={selectedConversation.otherUser?.avatar_url || ""} />
              <AvatarFallback className="bg-secondary text-primary">
                {(selectedConversation.otherUser?.display_name || "U")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">
              {selectedConversation.otherUser?.display_name || "User"}
            </span>
          </div>

          {/* Messages area */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg) => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      isOwn ? "justify-end" : "justify-start"
                    )}
                  >
                    <div className={cn(
                      "max-w-[70%] px-4 py-2 rounded-2xl",
                      isOwn && "bg-primary text-primary-foreground",
                      !isOwn && "bg-secondary"
                    )}>
                      <p className="text-sm">{msg.content}</p>
                      <span className={cn(
                        "text-xs mt-1 block",
                        isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message input */}
          <div className="p-4 border-t border-primary/30 flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              className="bg-secondary/50 border-primary/30"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold">
          Messages
        </h1>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {(conversations && conversations.length > 0 ? conversations : DEMO_CONVERSATIONS).map((conv) => (
              <Card
                key={conv.id}
                className="p-4 cursor-pointer transition-all hover:shadow-md border-primary/30 hover:bg-secondary/50"
                onClick={() => setSelectedConversation(conv)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="ring-2 ring-primary/30">
                    <AvatarImage src={conv.otherUser?.avatar_url || ""} />
                    <AvatarFallback className="bg-secondary text-primary">
                      {(conv.otherUser?.display_name || "U")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {conv.otherUser?.display_name || "User"}
                    </p>
                    {conv.lastMessage && (
                      <p className="text-sm truncate text-muted-foreground">
                        {conv.lastMessage.content}
                      </p>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conv.lastMessage.created_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Messages;
