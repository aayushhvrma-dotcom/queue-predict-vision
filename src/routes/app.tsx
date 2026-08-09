import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Map as MapIcon, Bookmark, User, LogOut, LogIn } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "QueuePredict — Live crowd levels & wait times near you" },
      {
        name: "description",
        content:
          "Interactive map with live crowd levels, estimated wait times and 4-hour AI queue forecasts for banks, hospitals and pharmacies near you.",
      },
      { property: "og:title", content: "QueuePredict — Live queue map" },
      {
        property: "og:description",
        content: "See how crowded a place is before you go, and report what you find.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppLayout,
});

const NAV = [
  { to: "/app", label: "Map", icon: MapIcon, exact: true },
  { to: "/app/saved", label: "Saved", icon: Bookmark, exact: false },
  { to: "/app/profile", label: "Profile", icon: User, exact: false },
] as const;

function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Could not sign out. Please try again.");
      return;
    }
    toast.success("Signed out");
    void navigate({ to: "/app", replace: true });
  }

  return (
    <div className="qp-scope relative flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-[1300] hidden w-20 flex-col items-center gap-2 border-r border-white/5 bg-[#211D2B]/80 py-5 backdrop-blur-xl md:flex">
        <Link to="/" className="qp-gradient mb-4 flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold text-white">
          QP
        </Link>
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex w-14 flex-col items-center gap-1 rounded-2xl py-2.5 text-[10px] transition-colors ${
                active
                  ? "bg-white/10 text-qp-text"
                  : "text-qp-muted hover:bg-white/5 hover:text-qp-text"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <div className="mt-auto">
          {user ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-14 flex-col items-center gap-1 rounded-2xl py-2.5 text-[10px] text-qp-muted transition-colors hover:bg-white/5 hover:text-qp-danger"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: "/app" }}
              className="flex w-14 flex-col items-center gap-1 rounded-2xl py-2.5 text-[10px] text-qp-muted transition-colors hover:bg-white/5 hover:text-qp-text"
            >
              <LogIn className="h-5 w-5" />
              Sign in
            </Link>
          )}
        </div>
      </aside>

      <div className="w-full pb-16 md:pb-0 md:pl-20">
        <Outlet />
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-[1300] flex items-center justify-around border-t border-white/5 bg-[#211D2B]/90 py-2 backdrop-blur-xl md:hidden">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] ${
                active ? "text-qp-primary-soft" : "text-qp-muted"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        {user ? (
          <button
            type="button"
            onClick={handleSignOut}
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] text-qp-muted"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        ) : (
          <Link
            to="/auth"
            search={{ redirect: "/app" }}
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] text-qp-muted"
          >
            <LogIn className="h-5 w-5" />
            Sign in
          </Link>
        )}
      </nav>
    </div>
  );
}
