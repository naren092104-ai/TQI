import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sparkles, Users, School, Wallet, Shield, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { loginUser } from "@/lib/api/auth";
import { saveToken, saveUser } from "@/utils/auth";
import { isClusterAdmin } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — TQI Admin" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const authStore = useAuth();
  const [forgot, setForgot] = useState(false);
  const s = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const response = await loginUser({ email, password });
      saveToken(response.token);
      saveUser(response.user);
      authStore.login(email, response.user);
      toast.success("Welcome to TQI Command Center");

      // Role-based redirect
      if (isClusterAdmin(response.user.role)) {
        nav({ to: "/cluster-dashboard" });
      } else {
        nav({ to: "/" });
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    }
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* HERO */}
        <div className="relative hidden flex-col gradient-hero p-10 text-primary-foreground lg:flex">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="TQI Logo" width={44} height={44} className="shrink-0 rounded-lg" />
            <div>
              <div className="text-lg font-bold">Talent Quest for India</div>
              <div className="text-xs text-primary-foreground/70">Super Admin Command Center</div>
            </div>
          </div>
          <div className="my-auto max-w-md space-y-6">
            <h1 className="text-4xl font-black leading-tight">
              Empowering children, <br />
              <span className="text-secondary">one village at a time.</span>
            </h1>
            <p className="text-primary-foreground/80">
              Manage clusters, schools, volunteers, sessions and finances for India&apos;s
              largest grassroots talent program — all from a single command center.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Users, label: "Students", v: s.students.length.toLocaleString() },
                { icon: School, label: "Schools", v: s.schools.length.toLocaleString() },
                { icon: Wallet, label: "Clusters", v: s.clusters.length.toLocaleString() },
                { icon: Shield, label: "Volunteers", v: s.volunteers.length.toLocaleString() },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-4 backdrop-blur">
                  <k.icon className="h-5 w-5 text-secondary" />
                  <div className="mt-2 text-2xl font-bold">{k.v}</div>
                  <div className="text-xs text-primary-foreground/70">{k.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-primary-foreground/60">© 2026 Talent Quest for India</div>
        </div>

        {/* FORM */}
        <div className="flex items-center justify-center p-6 sm:p-10">
          <Card className="w-full max-w-md shadow-glow">
            <CardContent className="p-8">
              <div className="mb-6 flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" /> Welcome back
              </div>
              <h2 className="text-2xl font-bold">Sign in to TQI Admin</h2>
              <p className="mt-1 text-sm text-muted-foreground">Use your organization credentials.</p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter your email" />
                </div>
                <div>
                  <Label htmlFor="pw">Password</Label>
                  <div className="relative">
                    <Input
                      id="pw"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox defaultChecked /> Remember me
                  </label>
                  <button type="button" onClick={() => setForgot(true)} className="text-sm font-medium text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
                <Button type="submit" className="h-11 w-full text-sm font-semibold">Sign in</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>


      <Dialog open={forgot} onOpenChange={setForgot}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Enter your email to receive a reset link.</DialogDescription>
          </DialogHeader>
          <Input placeholder="you@tqi.org" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgot(false)}>Cancel</Button>
            <Button onClick={() => { toast.success("Reset link sent"); setForgot(false); }}>Send link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
