import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { recims } from "@/api/recimsClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogIn, Mail, Lock, AlertCircle, Loader2, Package } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Use RecIMS SDK login
      await recims.auth.login({ email, password });
      
      // Redirect to dashboard after successful login
      navigate("/Dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Invalid email or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid gap-8 md:grid-cols-[1.1fr,1fr] items-stretch">
        <div className="hidden md:flex flex-col justify-between rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 p-10 text-white shadow-2xl">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                <img src="/recims-logo.svg" alt="RecIMS" className="h-9 w-9" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-emerald-100/80">RecIMS</p>
                <p className="text-lg font-semibold">Inventory Intelligence</p>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight">Trusted access to your warehouse nerve centre.</h1>
              <p className="text-emerald-100/90 text-base">
                Authenticate securely to unlock analytics, orchestration tools, and automation workflows across every RecIMS module.
              </p>
            </div>

            <ul className="space-y-4 text-sm text-emerald-50/90">
              <li className="flex items-center gap-3">
                <Package className="h-5 w-5" />
                Real-time inventory dashboards and performance insights.
              </li>
              <li className="flex items-center gap-3">
                <Lock className="h-5 w-5" />
                Role-aware access that keeps your tenant data secure.
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-5 w-5" />
                Intelligent alerts delivering operational context instantly.
              </li>
            </ul>
          </div>

          <div className="text-xs text-emerald-50/70">
            © {new Date().getFullYear()} RecIMS. All rights reserved.
          </div>
        </div>

        <Card className="shadow-xl border border-slate-200">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl font-semibold text-slate-900">Sign in to RecIMS</CardTitle>
            <CardDescription className="text-base text-slate-600">
              Enter your credentials to continue orchestrating your supply chain.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="border-red-500/60 bg-red-50 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="team@recims.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 text-slate-900"
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 h-12 text-slate-900"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-slate-500">Need support? <span className="font-medium text-slate-700">support@recims.com</span></div>
                <Link to="/ForgotPassword" className="font-medium text-emerald-600 hover:text-emerald-700">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
