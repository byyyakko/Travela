import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRateLimit, RATE_LIMITS } from "@/hooks/useRateLimit";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";

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
  const { theme } = useTheme();
  const { checkRateLimit } = useRateLimit();
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

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

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
  }, [selectedConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    // Check rate limit
    const allowed = await checkRateLimit(RATE_LIMITS.SEND_MESSAGE);
    if (!allowed) {
      toast({
        title: "Slow down!",
        description: "You're sending messages too quickly. Please wait a moment.",
        variant: "destructive",
      });
      return;
    }

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
        <Card className={cn(
          "h-[calc(100vh-12rem)] flex flex-col",
          theme === "cutesy" && "border-pink-200",
          theme === "anime" && "border-purple-500/30 bg-purple-900/50"
        )}>
          {/* Chat header */}
          <div className={cn(
            "p-4 border-b flex items-center gap-3",
            theme === "cutesy" && "border-pink-200",
            theme === "anime" && "border-purple-500/30"
          )}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedConversation(null)}
              className={cn(
                theme === "anime" && "text-purple-300 hover:text-white"
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Avatar className={cn(
              theme === "cutesy" && "ring-2 ring-pink-200",
              theme === "anime" && "ring-2 ring-purple-500"
            )}>
              <AvatarImage src={selectedConversation.otherUser?.avatar_url || ""} />
              <AvatarFallback className={cn(
                theme === "cutesy" && "bg-pink-100 text-pink-600",
                theme === "anime" && "bg-purple-700 text-cyan-400"
              )}>
                {(selectedConversation.otherUser?.display_name || "U")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className={cn(
              "font-medium",
              theme === "anime" && "text-white"
            )}>
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
                      isOwn && theme === "minimalist" && "bg-primary text-primary-foreground",
                      isOwn && theme === "cutesy" && "bg-pink-500 text-white",
                      isOwn && theme === "anime" && "bg-gradient-to-r from-pink-500 to-cyan-500 text-white",
                      !isOwn && theme === "minimalist" && "bg-muted",
                      !isOwn && theme === "cutesy" && "bg-pink-100",
                      !isOwn && theme === "anime" && "bg-purple-800 text-purple-100"
                    )}>
                      <p className="text-sm">{msg.content}</p>
                      <span className={cn(
                        "text-xs mt-1 block",
                        isOwn ? "text-white/70" : "text-muted-foreground"
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
          <div className={cn(
            "p-4 border-t flex gap-2",
            theme === "cutesy" && "border-pink-200",
            theme === "anime" && "border-purple-500/30"
          )}>
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              className={cn(
                theme === "cutesy" && "bg-pink-50 border-pink-200",
                theme === "anime" && "bg-purple-900/50 border-purple-500/30 text-white placeholder:text-purple-300"
              )}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className={cn(
                theme === "cutesy" && "bg-pink-500 hover:bg-pink-600",
                theme === "anime" && "bg-gradient-to-r from-pink-500 to-cyan-500"
              )}
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
        <h1 className={cn(
          "text-2xl font-display font-bold",
          theme === "anime" && "text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-400"
        )}>
          Messages
        </h1>

        {isLoading ? (
          <div className="text-center py-12">
            <div className={cn(
              "inline-block w-8 h-8 border-4 border-t-transparent rounded-full animate-spin",
              theme === "minimalist" && "border-primary",
              theme === "cutesy" && "border-pink-400",
              theme === "anime" && "border-cyan-400"
            )} />
          </div>
        ) : conversations?.length === 0 ? (
          <Card className={cn(
            "p-12 text-center",
            theme === "cutesy" && "bg-pink-50 border-pink-200",
            theme === "anime" && "bg-purple-900/50 border-purple-500/30"
          )}>
            <MessageCircle className={cn(
              "w-16 h-16 mx-auto mb-4",
              theme === "minimalist" && "text-muted-foreground",
              theme === "cutesy" && "text-pink-300",
              theme === "anime" && "text-purple-400"
            )} />
            <h3 className={cn(
              "text-xl font-display font-semibold mb-2",
              theme === "anime" && "text-white"
            )}>
              No Messages Yet
            </h3>
            <p className={cn(
              theme === "anime" ? "text-purple-300" : "text-muted-foreground"
            )}>
              Match with locals to start a conversation!
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {conversations?.map((conv) => (
              <Card
                key={conv.id}
                className={cn(
                  "p-4 cursor-pointer transition-all hover:shadow-md",
                  theme === "cutesy" && "border-pink-200 hover:bg-pink-50",
                  theme === "anime" && "border-purple-500/30 bg-purple-900/50 hover:bg-purple-800/50"
                )}
                onClick={() => setSelectedConversation(conv)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className={cn(
                    theme === "cutesy" && "ring-2 ring-pink-200",
                    theme === "anime" && "ring-2 ring-purple-500"
                  )}>
                    <AvatarImage src={conv.otherUser?.avatar_url || ""} />
                    <AvatarFallback className={cn(
                      theme === "cutesy" && "bg-pink-100 text-pink-600",
                      theme === "anime" && "bg-purple-700 text-cyan-400"
                    )}>
                      {(conv.otherUser?.display_name || "U")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium",
                      theme === "anime" && "text-white"
                    )}>
                      {conv.otherUser?.display_name || "User"}
                    </p>
                    {conv.lastMessage && (
                      <p className={cn(
                        "text-sm truncate",
                        theme === "anime" ? "text-purple-300" : "text-muted-foreground"
                      )}>
                        {conv.lastMessage.content}
                      </p>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <span className={cn(
                      "text-xs",
                      theme === "anime" ? "text-purple-400" : "text-muted-foreground"
                    )}>
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
