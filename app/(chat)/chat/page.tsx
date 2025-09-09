"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useSync } from "@/providers/sync-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PlusIcon,
  SendIcon,
  TrashIcon,
  ChevronDownIcon,
  XIcon,
  MenuIcon,
  PaperclipIcon,
  FileIcon,
  ImageIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UsageBadge } from "@/components/ui/usage-badge";
import { AVAILABLE_MODELS } from "@/lib/constants";
import { MessageRenderer } from "@/components/message-renderer";
import { checkApiKeys } from "@/app/actions/check-keys";
import type { ApiKeysStatus } from "@/app/actions/check-keys";

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // base64 or text content
  mimeType: string;
  /**
   * Relative path of the file inside the Supabase "files" bucket.  Used
   * to re-download the file when it is not present in localStorage.
   */
  supabasePath?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  attachments?: Attachment[];
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatsData {
  chats: Chat[];
  currentChatId: string | null;
}

export default function ChatPage() {
  const { state, updateState, isLoading } = useSync();
  const [inputMessage, setInputMessage] = useState("");
  const [isLoadingMessage, setIsLoadingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [shouldFocusInput, setShouldFocusInput] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [apiKeysStatus, setApiKeysStatus] = useState<ApiKeysStatus | null>(
    null
  );

  // Get data from centralized state with defaults
  const chatsData: ChatsData = state.chats || {
    chats: [],
    currentChatId: null,
  };
  const selectedModel: string = state.selectedModel || "gpt-3.5-turbo";
  const [user, setUser] = useState<any>(null);

  const supabase = createClient();

  // Check authentication and load API key
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    checkAuth();
  }, []);

  // Check server-side API keys status
  useEffect(() => {
    const run = async () => {
      try {
        const status = await checkApiKeys();
        setApiKeysStatus(status);
      } catch {
        setApiKeysStatus({
          openai: false,
          anthropic: false,
          gemini: false,
        });
      }
    };
    run();
  }, []);

  // Update currentChat when state.chats changes
  useEffect(() => {
    const latestChatsData: ChatsData = state.chats || {
      chats: [],
      currentChatId: null,
    };
    const foundChat = latestChatsData.chats.find(
      (chat) => chat.id === latestChatsData.currentChatId
    );
    setCurrentChat(foundChat || null);
  }, [state.chats]);

  // Focus input when page loads and when current chat changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentChat]);

  // Focus input when shouldFocusInput is true
  useEffect(() => {
    if (shouldFocusInput) {
      inputRef.current?.focus();
      setShouldFocusInput(false);
    }
  }, [shouldFocusInput]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatsData.chats, streamingMessage]);

  // Update selected model when it changes
  const handleModelChange = (modelId: string) => {
    updateState("selectedModel", modelId);
  };

  const saveChats = async (newChatsData: ChatsData) => {
    await updateState("chats", newChatsData);
  };

  const createNewChat = async (): Promise<Chat> => {
    const newChat: Chat = {
      id: uuidv4(),
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newChatsData = {
      chats: [newChat, ...chatsData.chats],
      currentChatId: newChat.id,
    };

    await saveChats(newChatsData);
    return newChat;
  };

  const handleCreateNewChat = () => {
    createNewChat().catch(console.error);
  };

  const selectChat = async (chatId: string) => {
    const newChatsData = {
      ...chatsData,
      currentChatId: chatId,
    };
    await saveChats(newChatsData);
  };

  const deleteChat = async (chatId: string) => {
    const updatedChats = chatsData.chats.filter((chat) => chat.id !== chatId);
    const newCurrentChatId =
      chatsData.currentChatId === chatId
        ? updatedChats.length > 0
          ? updatedChats[0].id
          : null
        : chatsData.currentChatId;

    const newChatsData = {
      chats: updatedChats,
      currentChatId: newCurrentChatId,
    };

    await saveChats(newChatsData);
  };

  /**
   * Helper: Upload a file to the Supabase Storage bucket named "files".
   * Returns the object path or null if the upload failed.
   */
  const uploadFileToSupabase = async (
    file: File,
    attachmentId: string
  ): Promise<string | null> => {
    try {
      // Get current user ID for folder organization
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      const userId = currentUser?.id || "anonymous";

      const filePath = `${userId}/${attachmentId}-${file.name}`;
      const { error } = await supabase.storage
        .from("files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (error) {
        console.error("Supabase upload error:", error);
        return null;
      }

      return filePath;
    } catch (err) {
      console.error("Unexpected error during Supabase upload:", err);
      return null;
    }
  };

  // When a chat is opened, make sure every attachment has its data. If it is
  // missing, try localStorage first and then fetch from Supabase Storage.
  useEffect(() => {
    const hydrateAttachments = async () => {
      if (!currentChat) return;

      let chatModified = false;

      const hydratedMessages: Message[] = await Promise.all(
        currentChat.messages.map(async (msg: Message) => {
          if (!msg.attachments || msg.attachments.length === 0) return msg;

          const refreshedAttachments: Attachment[] = await Promise.all(
            msg.attachments.map(async (att: Attachment) => {
              if (att.data) return att;

              const cacheKey = `attachment_${att.id}`;
              const cachedData = localStorage.getItem(cacheKey);
              if (cachedData) {
                return { ...att, data: cachedData };
              }

              if (att.supabasePath) {
                try {
                  const { data, error } = await supabase.storage
                    .from("files")
                    .download(att.supabasePath);

                  if (error || !data) {
                    console.error("Supabase download error:", error);
                    return att;
                  }

                  let newData: string;
                  if (att.type === "text") {
                    newData = await data.text();
                  } else {
                    newData = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onloadend = () => resolve(reader.result as string);
                      reader.onerror = () => reject(reader.error);
                      reader.readAsDataURL(data);
                    });
                  }

                  try {
                    localStorage.setItem(cacheKey, newData);
                  } catch {}

                  return { ...att, data: newData };
                } catch (e) {
                  console.error("Unexpected error downloading attachment:", e);
                }
              }

              return att;
            })
          );

          if (
            refreshedAttachments.some(
              (a, idx) => !msg.attachments![idx].data && a.data
            )
          ) {
            chatModified = true;
            return { ...msg, attachments: refreshedAttachments };
          }

          return msg;
        })
      );

      if (chatModified) {
        const allChatsData: ChatsData = state.chats || chatsData;
        const patchedChats = allChatsData.chats.map((c) =>
          c.id === currentChat.id ? { ...c, messages: hydratedMessages } : c
        );

        await saveChats({ ...allChatsData, chats: patchedChats });
      }
    };

    hydrateAttachments().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChat]);

  const processFile = async (file: File): Promise<Attachment> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result as string;

        // For images, keep as base64
        if (file.type.startsWith("image/")) {
          resolve({
            id: uuidv4(),
            name: file.name,
            type: "image",
            size: file.size,
            data: result, // includes data:image/jpeg;base64, prefix
            mimeType: file.type,
          });
        }
        // For text files, extract text content
        else if (
          file.type.startsWith("text/") ||
          file.type === "application/json"
        ) {
          resolve({
            id: uuidv4(),
            name: file.name,
            type: "text",
            size: file.size,
            data: result,
            mimeType: file.type,
          });
        }
        // For other files, treat as binary (base64)
        else {
          resolve({
            id: uuidv4(),
            name: file.name,
            type: "file",
            size: file.size,
            data: result,
            mimeType: file.type,
          });
        }
      };

      reader.onerror = () => reject(reader.error);

      // Read as base64 for images and binary files, as text for text files
      if (file.type.startsWith("text/") || file.type === "application/json") {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files) return;

    setIsUploadingFiles(true);
    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }

      // Check if it's a supported file type
      const supportedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "text/plain",
        "text/csv",
        "application/json",
        "text/markdown",
      ];

      if (!supportedTypes.includes(file.type)) {
        alert(
          `File type ${file.type} is not supported. Supported types: images (JPEG, PNG, GIF, WebP) and text files (TXT, CSV, JSON, MD).`
        );
        continue;
      }

      try {
        const attachment = await processFile(file);

        // Upload to Supabase Storage
        const supabasePath = await uploadFileToSupabase(file, attachment.id);
        if (supabasePath) {
          attachment.supabasePath = supabasePath;
        }

        // Cache the file data in localStorage for quick retrieval later
        try {
          localStorage.setItem(`attachment_${attachment.id}`, attachment.data);
        } catch (error) {
          console.error(
            "Error storing attachment data in localStorage:",
            error
          );
          // Storing large files may exceed quota – ignore failures silently
        }

        newAttachments.push(attachment);
      } catch (error) {
        console.error("Error processing file:", error);
        alert(`Error processing file ${file.name}`);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    setIsUploadingFiles(false);
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
  };

  const formatMessagesForAPI = (
    messages: Message[],
    provider: "openai" | "anthropic"
  ) => {
    return messages.map((message) => {
      if (!message.attachments || message.attachments.length === 0) {
        return {
          role: message.role,
          content: message.content,
        };
      }

      // Message has attachments - convert to multimodal format
      const contentParts: any[] = [];

      // Add text content if present
      if (message.content.trim()) {
        contentParts.push({
          type: "text",
          text: message.content,
        });
      }

      // Add attachments
      message.attachments.forEach((attachment) => {
        if (attachment.type === "image") {
          if (provider === "openai") {
            contentParts.push({
              type: "image_url",
              image_url: {
                url: attachment.data, // includes data:image/jpeg;base64, prefix
              },
            });
          } else if (provider === "anthropic") {
            // Extract base64 data without the data URL prefix
            const base64Data = attachment.data.split(",")[1];
            contentParts.push({
              type: "image",
              source: {
                type: "base64",
                media_type: attachment.mimeType,
                data: base64Data,
              },
            });
          }
        } else if (attachment.type === "text") {
          // For text files, include the content as text
          contentParts.push({
            type: "text",
            text: `File: ${attachment.name}\n\n${attachment.data}`,
          });
        }
      });

      return {
        role: message.role,
        content: contentParts,
      };
    });
  };

  // Call Anthropic directly from the browser. Note that CORS is enabled by
  // sending the special header: "anthropic-dangerous-direct-browser-access".

  const callBackendAPI = async (
    messages: Array<{ role: string; content: string | any[] }>
  ) => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        model: selectedModel,
        provider:
          AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.provider ||
          "openai",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to send message");
    }

    return response;
  };

  const sendMessage = async () => {
    if ((!inputMessage.trim() && attachments.length === 0) || isLoadingMessage)
      return;

    const modelProvider =
      AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.provider ||
      "openai";

    if (!currentChat) return;

    // Clear input and show loading immediately
    const messageContent = inputMessage.trim();
    const messageAttachments =
      attachments.length > 0 ? [...attachments] : undefined;

    setInputMessage("");
    setAttachments([]);
    setIsLoadingMessage(true);
    setStreamingMessage("");

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
      attachments: messageAttachments,
    };

    // Add user message - use the current state
    const currentChatsData = state.chats || chatsData;
    const updatedChats = currentChatsData.chats.map((chat: Chat) =>
      chat.id === currentChat!.id
        ? {
            ...chat,
            messages: [...chat.messages, userMessage],
            updatedAt: new Date(),
          }
        : chat
    );

    let newChatsData = {
      ...currentChatsData,
      chats: updatedChats,
    };

    await saveChats(newChatsData);

    const messagesToSend = formatMessagesForAPI(
      [...currentChat.messages, userMessage],
      (modelProvider as "openai" | "anthropic") || "openai"
    );

    let assistantContent = "";

    try {
      // Attempt a direct browser call when an API key is available.

      // If frontend call failed and user is logged in, or no API key but user logged in
      if (user) {
        const response = await callBackendAPI(messagesToSend);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  break;
                }
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === "content" && parsed.content) {
                    assistantContent += parsed.content;
                    setStreamingMessage(assistantContent);
                  }
                } catch (error) {
                  console.error("Error parsing response:", error);
                  // Ignore parsing errors
                }
              }
            }
          }
        }
      }

      // Clear the in-progress streaming message before finalizing
      setStreamingMessage("");

      // Add assistant message
      const assistantMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
        model: selectedModel,
      };

      // Use the newChatsData which we know includes the user message
      const finalUpdatedChats = newChatsData.chats.map((chat: Chat) =>
        chat.id === currentChat!.id
          ? {
              ...chat,
              messages: [...chat.messages, assistantMessage], // Add assistant message to existing messages (including user message)
              updatedAt: new Date(),
              title:
                chat.messages.length === 1
                  ? chat.messages[0].content.substring(0, 50) +
                    (chat.messages[0].content.length > 50 ? "..." : "")
                  : chat.title,
            }
          : chat
      );

      newChatsData = {
        ...newChatsData,
        chats: finalUpdatedChats,
      };

      await saveChats(newChatsData);
    } catch (error) {
      console.error("Error sending message:", error);
      // If we deducted a credit but failed, we should ideally refund it
      // For now, we'll just show the error
    } finally {
      setIsLoadingMessage(false);
      setStreamingMessage("");
      // Trigger input focus after all state updates complete
      setShouldFocusInput(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Show loading state while sync provider is loading
  if (isLoading) {
    return (
      <div className="flex h-full w-full bg-background min-h-0">
        {/* Sidebar Skeleton */}
        <div className="w-80 border-r bg-background flex flex-col hidden md:flex">
          <div className="p-4 border-b">
            <Skeleton className="w-full h-10 mb-3" />
            <div className="p-3 mb-3 border rounded-md">
              <Skeleton className="h-4 w-12 mb-2" />
              <Skeleton className="h-8 w-full mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="p-3 border rounded-md">
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-3 w-24 mb-1" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 border rounded-md">
                <Skeleton className="h-4 w-3/4 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area Skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="border-b p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 md:hidden" />
              <div className="flex-1">
                <Skeleton className="h-6 w-40 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`flex ${
                  i % 2 === 0 ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-md ${
                    i % 2 === 0 ? "bg-primary/10" : "bg-muted"
                  }`}
                >
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Skeleton className="flex-1 h-10" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background min-h-0 relative">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        w-80 border-r bg-background flex flex-col
        fixed md:relative inset-y-0 left-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }
      `}
      >
        {user && (
          <div className="px-4 mx-auto mt-4">
            <UsageBadge
              featureSlug="chat-messages"
              label="AI Chat Requests:"
              labelAfter="used"
              creditCalculation="used"
            />
          </div>
        )}
        <div className="p-3 md:p-4 border-b">
          {/* Mobile header with close button */}
          <div className="flex items-center justify-between mb-3 md:hidden">
            <h2 className="font-semibold">Menu</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(false)}
              className="p-2"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>

          <Button
            onClick={() => {
              handleCreateNewChat();
              setIsSidebarOpen(false);
            }}
            className="w-full justify-start mb-3"
            variant="outline"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Chat
          </Button>

          {/* Model Selection */}
          <Card className="p-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-xs font-medium mb-1">Model</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto"
                    >
                      <div className="text-left">
                        <p className="text-xs font-medium">
                          {AVAILABLE_MODELS.find((m) => m.id === selectedModel)
                            ?.name || selectedModel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {
                            AVAILABLE_MODELS.find((m) => m.id === selectedModel)
                              ?.description
                          }
                        </p>
                      </div>
                      <ChevronDownIcon className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {AVAILABLE_MODELS.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        onClick={() => handleModelChange(model.id)}
                        className="flex flex-col items-start gap-1 p-3"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span className="font-medium">{model.name}</span>
                          {model.id === selectedModel && (
                            <Badge variant="secondary" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {model.description}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2">
          {chatsData.chats.map((chat) => (
            <Card
              key={chat.id}
              className={`cursor-pointer transition-colors ${
                chat.id === chatsData.currentChatId
                  ? "bg-accent"
                  : "hover:bg-muted"
              }`}
              onClick={() => {
                selectChat(chat.id);
                setIsSidebarOpen(false);
              }}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {chat.messages.length} messages
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                  >
                    <TrashIcon className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col md:ml-0">
        {apiKeysStatus && !apiKeysStatus.openai && !apiKeysStatus.anthropic && (
          <div className="p-2 md:p-3">
            <Card className="border-red-300 bg-red-50 dark:bg-red-950/30">
              <CardContent className="p-3">
                <p className="text-sm text-red-900 dark:text-red-200">
                  No AI provider keys detected. Set environment variables
                  <span className="mx-1 font-mono">OPENAI_API_KEY</span>
                  and/or
                  <span className="mx-1 font-mono">ANTHROPIC_API_KEY</span>
                  and restart the dev server.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
        {currentChat ? (
          <>
            {/* Chat Header */}
            <div className="border-b p-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden p-2"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <MenuIcon className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                  <CardTitle className="text-lg truncate">
                    {currentChat.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {currentChat.messages.length} messages
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 md:space-y-4">
              {currentChat.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <Card
                    className={`max-w-[90%] md:max-w-[80%] ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <CardContent className="p-2 md:p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          {/* Show attachments if present */}
                          {message.attachments &&
                            message.attachments.length > 0 && (
                              <div className="mb-2 space-y-2">
                                {message.attachments.map((attachment) => (
                                  <div
                                    key={attachment.id}
                                    className="flex items-center gap-2"
                                  >
                                    {attachment.type === "image" ? (
                                      <div className="flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4 opacity-70" />
                                        <img
                                          src={attachment.data}
                                          alt={attachment.name}
                                          className="max-w-[200px] max-h-[200px] object-contain rounded border"
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 p-2 rounded border bg-background/50">
                                        <FileIcon className="h-4 w-4 opacity-70" />
                                        <span className="text-xs opacity-70">
                                          {attachment.name}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                          <MessageRenderer
                            content={message.content}
                            isUser={message.role === "user"}
                          />
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <p className="text-xs opacity-70">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </p>
                            {message.model && (
                              <Badge variant="secondary" className="text-xs">
                                {message.model}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}

              {/* Loading Animation - shown after user sends message until streaming starts */}
              {isLoadingMessage &&
                !streamingMessage &&
                currentChat &&
                currentChat.messages.length > 0 &&
                currentChat.messages[currentChat.messages.length - 1].role ===
                  "user" && (
                  <div className="flex justify-start">
                    <Card className="max-w-[90%] md:max-w-[80%] bg-muted">
                      <CardContent className="p-2 md:p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

              {/* Streaming Message */}
              {streamingMessage && (
                <div className="flex justify-start">
                  <Card className="max-w-[90%] md:max-w-[80%] bg-muted">
                    <CardContent className="p-2 md:p-3">
                      <MessageRenderer
                        content={streamingMessage}
                        isStreaming={true}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t p-2 md:p-4">
              {/* Attachments Preview */}
              {(attachments.length > 0 || isUploadingFiles) && (
                <div className="mb-3 p-3 bg-muted rounded-md">
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="relative">
                        <div className="flex items-center gap-2 p-2 bg-white rounded border">
                          {attachment.type === "image" ? (
                            <div className="flex items-center gap-2">
                              <ImageIcon className="h-4 w-4" />
                              <img
                                src={attachment.data}
                                alt={attachment.name}
                                className="h-8 w-8 object-cover rounded"
                              />
                            </div>
                          ) : (
                            <FileIcon className="h-4 w-4" />
                          )}
                          <span className="text-sm truncate max-w-[100px]">
                            {attachment.name}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(attachment.id)}
                            className="h-6 w-6 p-0 hover:bg-red-100"
                          >
                            <XIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {isUploadingFiles && (
                      <div className="flex items-center gap-2 p-2 bg-white rounded border">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          Uploading...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/jpeg,image/png,image/gif,image/webp,text/plain,text/csv,application/json,text/markdown"
                  multiple
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoadingMessage || isUploadingFiles}
                  className="px-3"
                >
                  {isUploadingFiles ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <PaperclipIcon className="h-4 w-4" />
                  )}
                </Button>
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isLoadingMessage}
                  className="flex-1 text-base md:text-sm"
                  ref={inputRef}
                />
                <Button
                  onClick={sendMessage}
                  disabled={
                    isLoadingMessage ||
                    (!inputMessage.trim() && attachments.length === 0)
                  }
                  className="px-3 md:px-4"
                >
                  <SendIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Empty state header with mobile menu */}
            <div className="border-b p-4 md:hidden">
              <Button
                variant="ghost"
                size="sm"
                className="p-2"
                onClick={() => setIsSidebarOpen(true)}
              >
                <MenuIcon className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center max-w-md">
                <h2 className="text-xl md:text-2xl font-bold mb-4">
                  Welcome to Chat
                </h2>
                <p className="text-muted-foreground mb-6 text-sm md:text-base">
                  Create a new chat to get started
                </p>
                <Button
                  onClick={handleCreateNewChat}
                  className="w-full md:w-auto"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Start New Chat
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
