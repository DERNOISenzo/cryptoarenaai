import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, LogOut, TrendingUp, FileText } from "lucide-react";

interface HeaderProps {
  userId?: string;
}

const Header = ({ userId }: HeaderProps) => {
  const [username, setUsername] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    
    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", userId)
        .single();

      if (data) {
        setUsername(data.username);
      }
    };

    loadProfile();
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <header className="w-full bg-card border-b border-border p-4">
      <div className="max-w-7xl mx-auto flex justify-end">
        {userId ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback>
                    {username ? username[0].toUpperCase() : "U"}
                  </AvatarFallback>
                </Avatar>
                <span>{username || "Utilisateur"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate('/market-analysis')} className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Analyse de Marché
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/trades')} className="gap-2">
                <FileText className="w-4 h-4" />
                Journal de Trades
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2">
                <User className="w-4 h-4" />
                Profil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="gap-2">
                <LogOut className="w-4 h-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button onClick={() => navigate("/auth")}>
            Se connecter
          </Button>
        )}
      </div>
    </header>
  );
};

export default Header;
