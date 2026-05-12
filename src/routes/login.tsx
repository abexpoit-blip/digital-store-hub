import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    nav({ to: "/dashboard" });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/30 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-accent/30 blur-[120px]" />
      </div>
      <form onSubmit={onSubmit} className="glass w-full max-w-md rounded-2xl p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[var(--primary-glow)] glow">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">Nexus Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Master access only · Owner panel</p>
        </div>

        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Master Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type={show ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••••••"
            className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-10 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <Button type="submit" disabled={loading} className="mt-6 h-12 w-full bg-gradient-to-r from-primary to-[var(--primary-glow)] text-primary-foreground hover:opacity-90 glow">
          {loading ? "Verifying…" : "Enter Panel"}
        </Button>

        <button type="button" onClick={skipLogin} className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm text-muted-foreground hover:bg-white/10 hover:text-foreground transition">
          → Skip & Enter Demo Panel
        </button>

        <div className="mt-5 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-center text-[11px] text-warning">
          ⚡ Preview mode — যেকোনো password কাজ করবে (try: <b>admin123</b>)<br/>
          Real password VPS এ deploy করার সময় <code>.env</code> file এ set হবে
        </div>
      </form>
    </div>
  );
}
