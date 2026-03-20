import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, Phone, MapPin, Bike, Shield, FileText, LogOut, ChevronRight } from "lucide-react";

const profileItems = [
  { icon: User, label: "Name", value: "Ravi Kumar" },
  { icon: Phone, label: "Phone", value: "+91 98765 43210" },
  { icon: MapPin, label: "City", value: "Bengaluru, Koramangala" },
  { icon: Bike, label: "Platform", value: "Swiggy" },
];

const Profile = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-xl font-bold text-foreground opacity-0 animate-fade-up">Profile</h1>
      </div>

      {/* Avatar + name */}
      <div className="px-5 mb-6 opacity-0 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-card">
            R
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Ravi Kumar</h2>
            <p className="text-sm text-muted-foreground">Swiggy · Bengaluru</p>
          </div>
        </div>
      </div>

      {/* Personal details */}
      <div className="px-5 mb-5 opacity-0 animate-fade-up" style={{ animationDelay: "160ms" }}>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Personal details</h3>
        <div className="bg-card rounded-2xl shadow-card divide-y divide-border">
          {profileItems.map((item) => (
            <div key={item.label} className="flex items-center gap-3 px-4 py-3.5">
              <item.icon size={18} className="text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-medium text-foreground">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active policy */}
      <div className="px-5 mb-5 opacity-0 animate-fade-up" style={{ animationDelay: "240ms" }}>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active policy</h3>
        <div className="bg-card rounded-2xl shadow-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground">
              <Shield size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Standard Plan</p>
              <p className="text-xs text-muted-foreground">₹49/week · Renews 22 Mar</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/10 text-success">
              Active
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/plans")} className="w-full">
            Change plan <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      {/* Quick links */}
      <div className="px-5 mb-6 opacity-0 animate-fade-up" style={{ animationDelay: "320ms" }}>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick links</h3>
        <div className="bg-card rounded-2xl shadow-card divide-y divide-border">
          <button
            onClick={() => navigate("/claims")}
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-secondary/50 transition-colors"
          >
            <FileText size={18} className="text-muted-foreground" />
            <span className="flex-1 text-sm font-medium text-foreground">Claim history</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-secondary/50 transition-colors"
          >
            <LogOut size={18} className="text-destructive" />
            <span className="flex-1 text-sm font-medium text-destructive">Log out</span>
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
