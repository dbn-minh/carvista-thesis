"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import { authApi } from "@/lib/carvista-api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("Test User");
  const [email, setEmail] = useState("user@example.com");
  const [phone, setPhone] = useState("0900000000");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await authApi.register({ name, email, phone, password });
      setTone("success");
      setMessage("Register successful. Redirecting to login...");
      setTimeout(() => router.push("/login"), 800);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Register failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="container-cars max-w-xl py-10">
        <h1 className="mb-6 text-3xl font-bold">Register</h1>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              required
            />
          </div>

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
            <label className="mb-1 block text-sm font-medium">Phone</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="text"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              minLength={6}
              required
            />
          </div>

          <button
            className="rounded bg-purple-800 px-4 py-2 text-white disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Creating..." : "Create account"}
          </button>

          <StatusBanner tone={tone}>{message}</StatusBanner>
        </form>
      </main>
    </>
  );
}
