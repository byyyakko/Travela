import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, getWsUrl } from "@/lib/dataClient";
import { aiTranslate } from "@/lib/aiClient";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send, MessageCircle, ArrowLeft, Languages, Star, Loader2, Check, X, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAnalytics } from "@/hooks/useAnalytics";
import { containsProfanity } from "@/lib/profanity";
import ReportBlockDialog from "@/components/ReportBlockDialog";
import type { MessageItem } from "@/lib/moderationClient";

interface Conversation {
  id: string;
  participant1_id: string;
  participant2_id: string;
  updated_at: string;
  accepted: boolean | null;
  declined_at: string | null;
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { track } = useAnalytics("messages");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [culturalDialogOpen, setCulturalDialogOpen] = useState(false);
  const [selectedMsgForTranslation, setSelectedMsgForTranslation] = useState<string>("");
  const [culturalResult, setCulturalResult] = useState<{
    cultural_context: string;
    suggested_response: string;
    tips: string[];
    politeness_level: string;
  } | null>(null);
  const [isCulturalLoading, setIsCulturalLoading] = useState(false);

  const handleCulturalTranslation = async (messageContent: string) => {
    setSelectedMsgForTranslation(messageContent);
    setCulturalDialogOpen(true);
    setCulturalResult(null);
    setIsCulturalLoading(true);

    try {
      const data = await aiTranslate(
        messageContent,
        selectedConversation?.otherUser?.display_name
          ? "the country the sender is from"
          : "unknown"
      );
      setCulturalResult(data);
    } catch {
      toast({ title: "Error", description: "Failed to analyze cultural context", variant: "destructive" });
      setCulturalDialogOpen(false);
    } finally {
      setIsCulturalLoading(false);
    }
  };

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      return apiGet<Conversation[]>("/conversations");
    },
    enabled: !!user,
  });

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const fetchMessages = async () => {
      const data = await apiGet<Message[]>(`/conversations/${selectedConversation.id}/messages`);
      setMessages(data || []);
    };

    fetchMessages();

    // Subscribe to new messages via WebSocket
    const wsUrl = getWsUrl(`/ws/conversations/${selectedConversation.id}`);
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      const msg: Message = JSON.parse(event.data);
      setMessages((prev) => [...prev, msg]);
    };

    return () => ws.close();
  }, [selectedConversation, user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Determine if current user can send messages in this conversation
  const canSendMessage = (conv: Conversation | null): boolean => {
    if (!conv || !user) return false;
    // Accepted conversations: both can send
    if (conv.accepted === true) return true;
    // Declined: nobody can send
    if (conv.accepted === false) return false;
    // Pending (null): only the initiator (participant1) can send the first message
    return conv.participant1_id === user.id;
  };

  // Check if current user is the recipient of a pending request
  const isPendingRequestForMe = (conv: Conversation | null): boolean => {
    if (!conv || !user) return false;
    return conv.accepted === null && conv.participant2_id === user.id;
  };

  const handleAcceptConversation = async (convId: string) => {
    try {
      await apiPatch(`/conversations/${convId}`, { accepted: true });
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
      if (selectedConversation?.id === convId) {
        setSelectedConversation({ ...selectedConversation!, accepted: true });
      }
      toast({ title: "Message request accepted!" });
    } catch {
      toast({ title: "Error", description: "Failed to accept conversation", variant: "destructive" });
    }
  };

  const handleDeclineConversation = async (convId: string) => {
    try {
      await apiPatch(`/conversations/${convId}`, { accepted: false });
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
      setSelectedConversation(null);
      toast({ title: "Message request declined" });
    } catch {
      toast({ title: "Error", description: "Failed to decline conversation", variant: "destructive" });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;
    if (!canSendMessage(selectedConversation)) return;

    if (containsProfanity(newMessage)) {
      toast({ title: "Inappropriate content", description: "Your message contains inappropriate language. Please revise it.", variant: "destructive" });
      return;
    }
    try {
      await apiPost(`/conversations/${selectedConversation.id}/messages`, { content: newMessage.trim() });
      track("message_sent", { conversation_id: selectedConversation.id });
      setNewMessage("");
    } catch {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
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
            <span className="font-medium flex-1">
              {selectedConversation.otherUser?.display_name || "User"}
            </span>
            {(() => {
              const otherUserId = selectedConversation.participant1_id === user?.id
                ? selectedConversation.participant2_id
                : selectedConversation.participant1_id;
              const msgItems: MessageItem[] = messages.map((m) => ({
                sender_id: m.sender_id,
                content: m.content,
                created_at: m.created_at,
              }));
              return (
                <ReportBlockDialog
                  targetUserId={otherUserId}
                  targetUserName={selectedConversation.otherUser?.display_name || "User"}
                  messages={msgItems}
                  conversationId={selectedConversation.id}
                  variant="header"
                />
              );
            })()}
          </div>

          {/* Messages area */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  No messages yet. Say hello! 👋
                </p>
              )}
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
                    <div className="flex flex-col gap-1">
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
                      {!isOwn && (
                        <button
                          onClick={() => handleCulturalTranslation(msg.content)}
                          className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors ml-1"
                        >
                          <Languages className="w-3 h-3" />
                          Cultural context
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Accept/Decline banner for pending requests */}
          {isPendingRequestForMe(selectedConversation) && (
            <div className="p-4 border-t border-primary/30 bg-secondary/50">
              <p className="text-sm text-muted-foreground mb-3 text-center">
                <strong>{selectedConversation.otherUser?.display_name || "Someone"}</strong> wants to message you
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => handleDeclineConversation(selectedConversation.id)}
                >
                  <X className="w-4 h-4" /> Decline
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => handleAcceptConversation(selectedConversation.id)}
                >
                  <Check className="w-4 h-4" /> Accept
                </Button>
              </div>
            </div>
          )}

          {/* Declined notice */}
          {selectedConversation.accepted === false && (
            <div className="p-4 border-t border-primary/30 text-center">
              <p className="text-sm text-muted-foreground">This conversation has been declined.</p>
            </div>
          )}

          {/* Pending notice for sender */}
          {selectedConversation.accepted === null && selectedConversation.participant1_id === user?.id && (
            <div className="p-4 border-t border-primary/30">
              <p className="text-xs text-muted-foreground text-center mb-3">
                Waiting for {selectedConversation.otherUser?.display_name || "them"} to accept your message request
              </p>
              <div className="flex gap-2">
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
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Normal message input for accepted conversations */}
          {selectedConversation.accepted === true && (
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
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </Card>

        {/* Cultural Translation Dialog */}
        <Dialog open={culturalDialogOpen} onOpenChange={setCulturalDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <Languages className="w-5 h-5" />
                Cultural Translation
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 ml-auto">
                  <Star className="w-3 h-3 mr-1" /> Plus
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="mt-2">
              <Card className="p-3 bg-secondary/50 mb-4">
                <p className="text-sm italic text-muted-foreground">"{selectedMsgForTranslation}"</p>
              </Card>

              {isCulturalLoading ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Analyzing cultural context...</p>
                </div>
              ) : culturalResult ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">🌍 Cultural Context</h4>
                    <p className="text-sm text-muted-foreground">{culturalResult.cultural_context}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">💬 Suggested Response</h4>
                    <Card className="p-3 bg-primary/5 border-primary/20">
                      <p className="text-sm">{culturalResult.suggested_response}</p>
                    </Card>
                  </div>

                  {culturalResult.tips?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-1">💡 Tips</h4>
                      <ul className="space-y-1">
                        {culturalResult.tips.map((tip, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Badge variant="outline" className="capitalize">
                    Tone: {culturalResult.politeness_level}
                  </Badge>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
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
        ) : !conversations || conversations.length === 0 ? (
          <Card className="p-12 text-center bg-secondary/50 border-primary/30">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-primary/40" />
            <h3 className="text-xl font-display font-semibold mb-2">No Conversations Yet</h3>
            <p className="text-muted-foreground">
              Match with locals to start chatting! When you both like each other, a conversation will appear here.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Pending message requests for current user */}
            {(() => {
              const pendingRequests = conversations.filter(
                (c) => c.accepted === null && c.participant2_id === user?.id
              );
              if (pendingRequests.length === 0) return null;
              return (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                    <Inbox className="w-4 h-4" /> Message Requests ({pendingRequests.length})
                  </h2>
                  {pendingRequests.map((conv) => (
                    <Card
                      key={conv.id}
                      className="p-4 cursor-pointer transition-all hover:shadow-md border-accent hover:bg-secondary/50"
                      onClick={() => setSelectedConversation(conv)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="ring-2 ring-accent">
                          <AvatarImage src={conv.otherUser?.avatar_url || ""} />
                          <AvatarFallback className="bg-secondary text-primary">
                            {(conv.otherUser?.display_name || "U")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">
                            {conv.otherUser?.display_name || "User"}
                          </p>
                          <p className="text-xs text-muted-foreground">Wants to message you</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">New</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              );
            })()}

            {/* Active conversations (accepted or sent by me pending) */}
            <div className="space-y-2">
              {conversations
                .filter((c) => c.accepted !== false && !(c.accepted === null && c.participant2_id === user?.id))
                .map((conv) => (
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
                      {conv.lastMessage ? (
                        <p className="text-sm truncate text-muted-foreground">
                          {conv.lastMessage.content}
                        </p>
                      ) : conv.accepted === null ? (
                        <p className="text-xs text-muted-foreground italic">Pending acceptance</p>
                      ) : null}
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
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Messages;
