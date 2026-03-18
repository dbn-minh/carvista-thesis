"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import { authApi } from "@/lib/carvista-api";
import { setStoredToken } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await authApi.login({ email, password });
      setStoredToken(res.token);
      setTone("success");
      setMessage("Login successful. Redirecting to Garage...");
      router.push("/garage");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="container-cars max-w-xl py-10">
        <h1 className="mb-6 text-3xl font-bold">Login</h1>
        <p className="mb-6 text-sm text-slate-600">
          Dùng đúng email/password đã register từ backend hiện tại.
        </p>
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </div>

          <button
            className="rounded bg-purple-800 px-4 py-2 text-white disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <StatusBanner tone={tone}>{message}</StatusBanner>
        </form>
      </main>
    </>
  );
}
