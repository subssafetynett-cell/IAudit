import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Search, User, LogOut, Settings, UserCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function TopNav() {
  const navigate = useNavigate();

  // State to hold the dynamic user
  const [user, setUser] = useState({
    firstName: "Audit",
    lastName: "User",
    email: "user@example.com"
  });

  const [isOpen, setIsOpen] = useState(false);

  // Load user from localStorage on mount and listen for updates
  useEffect(() => {
    const handleStorageChange = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          // Fallback to default if names are missing
          setUser({
            firstName: parsedUser.firstName || "Audit",
            lastName: parsedUser.lastName || "User",
            email: parsedUser.email || "user@example.com"
          });
        } catch (e) {
          console.error("Failed to parse user from local storage");
        }
      }
    };

    handleStorageChange(); // Initial load

    window.addEventListener('user-profile-updated', handleStorageChange);

    return () => {
      window.removeEventListener('user-profile-updated', handleStorageChange);
    }
  }, []);

  const handleLogout = () => {
    setIsOpen(false);
    localStorage.removeItem('user');
    navigate('/login');
  };

  const initials = `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase();

  return (
    <header className="h-20 flex items-center justify-between px-4 shrink-0 overflow-hidden bg-white border-b border-border/40">
      <div className="flex items-center">
        <SidebarTrigger className="lg:hidden h-10 w-10 text-muted-foreground mr-2" />
      </div>
      <div className="flex items-center gap-4">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-12 w-12 p-0 rounded-full hover:bg-transparent focus-visible:ring-0 mr-6">
              <div className="h-12 w-12 rounded-full bg-green-600 flex items-center justify-center shadow-md cursor-pointer hover:bg-green-700 transition-colors">
                <span className="text-base font-bold text-white tracking-wider">{initials}</span>
              </div>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[320px] sm:w-[400px] border-l border-border/40 p-0 flex flex-col bg-white">
            <div className="px-6 py-8 bg-[#f8fafc] border-b border-border/40 flex flex-col items-center text-center">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-white shadow-xl mb-4">
                <span className="text-2xl font-bold text-primary tracking-wider">{initials}</span>
              </div>
              <h2 className="text-xl font-bold text-[#1e293b]">{user.firstName} {user.lastName}</h2>
              <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
            </div>

            <div className="flex-1 py-4 flex flex-col gap-1 px-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/profile-settings');
                }}
                className="w-full justify-start h-14 px-4 text-[#475569] hover:text-[#1e293b] hover:bg-slate-100 rounded-xl group transition-all"
              >
                <UserCircle className="mr-3 h-5 w-5 group-hover:scale-110 transition-transform" />
                <span className="font-medium">Profile Settings</span>
                <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/account-settings');
                }}
                className="w-full justify-start h-14 px-4 text-[#475569] hover:text-[#1e293b] hover:bg-slate-100 rounded-xl group transition-all"
              >
                <Settings className="mr-3 h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
                <span className="font-medium">Account Settings</span>
                <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </div>

            <div className="p-4 border-t border-border/40 bg-slate-50 mt-auto">
              <Button
                variant="destructive"
                onClick={handleLogout}
                className="w-full justify-center h-12 rounded-xl group font-semibold shadow-sm"
              >
                <LogOut className="mr-2 h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
