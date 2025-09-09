import "../globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SyncProvider } from "@/providers/sync-provider";
import { ThemeSwitcher } from "@/components/theme-switcher";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Chat by Lumen",
  description: "Chat example with Lumen Payments",
  icons: {
    icon: [
      { url: "/icon.png" },
      { url: "/icon.png", sizes: "64x64", type: "image/png" },
    ],
    apple: [{ url: "/icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SyncProvider>
      <main className="h-screen flex flex-col max-w-[100rem] mx-auto bg-background relative">
        <div className="absolute top-3 right-3 z-50">
          <ThemeSwitcher />
        </div>
        <div className="flex-1 min-h-0">{children}</div>
      </main>
      <Toaster />
    </SyncProvider>
  );
}
