import { useLocation } from "wouter";
import { Home, Leaf, Bot, User } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const { t } = useLanguage();

  const NAV_ITEMS = [
    { path: "/dashboard", labelKey: "nav.home",     icon: Home },
    { path: "/practice",  labelKey: "nav.practice", icon: Leaf },
    { path: "/coach",     labelKey: "nav.coach",    icon: Bot  },
    { path: "/profile",   labelKey: "nav.profile",  icon: User },
  ];

  return (
    <nav
      className="bottom-nav fixed bottom-0 inset-x-0 z-30 bg-[#141814] border-t border-[#2D332D]"
      data-testid="bottom-nav"
      aria-label="Primary navigation"
    >
      <div className="max-w-4xl mx-auto px-2 h-16 flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          const active = location === item.path || (item.path === "/practice" && location.startsWith("/practice"));
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              data-testid={`nav-${item.labelKey.split(".")[1]}`}
              aria-label={label}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors duration-200 ${
                active ? "text-[#C8D5B9]" : "text-[#7A8A72] hover:text-[#A3B197]"
              }`}
            >
              <Icon className={`w-6 h-6 ${active ? "stroke-[2.5]" : ""}`} />
              <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
