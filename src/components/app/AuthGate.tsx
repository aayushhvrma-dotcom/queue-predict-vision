import { Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";

export function AuthGate({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="qp-card w-full max-w-sm rounded-3xl p-7 text-center">
        <span className="qp-gradient mx-auto flex h-12 w-12 items-center justify-center rounded-full">
          <LogIn className="h-5 w-5 text-white" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-qp-text">{title}</h2>
        <p className="mt-2 text-sm text-qp-muted">{description}</p>
        <Link
          to="/auth"
          search={{ redirect: typeof window === "undefined" ? "/app" : window.location.pathname }}
          className="qp-gradient mt-5 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Sign in / Sign up
        </Link>
      </div>
    </div>
  );
}
