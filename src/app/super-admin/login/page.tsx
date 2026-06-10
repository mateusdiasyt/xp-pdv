import { redirect } from "next/navigation";

import { MendozaLogo } from "@/components/platform/mendoza-logo";
import { SuperAdminLoginForm } from "@/components/platform/super-admin-login-form";
import { getServerAuthSession } from "@/lib/auth";

export default async function SuperAdminLoginPage() {
  const session = await getServerAuthSession();

  if (session?.user?.isPlatformAdmin && session.user.accessScope === "platform") {
    redirect("/super-admin");
  }

  return (
    <main className="min-h-screen bg-[#0b080a] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-[0_44px_160px_-86px_rgba(0,0,0,0.95)] lg:grid-cols-[0.9fr,1.1fr]">
          <div className="hidden border-r border-white/10 bg-[linear-gradient(145deg,rgba(255,0,89,0.14),rgba(255,255,255,0.035)_42%,rgba(0,0,0,0.18))] p-8 lg:block">
            <MendozaLogo className="h-16 w-32" />
            <div className="mt-16">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Painel da plataforma</p>
              <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight">
                Acesso reservado ao dono do sistema.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/62">
                Use este login apenas para aprovar clientes, revisar planos, status e ambientes cadastrados.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-8 lg:hidden">
              <MendozaLogo className="h-16 w-32" />
            </div>
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Super admin</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Entrar no painel</h2>
              <p className="mt-2 text-sm leading-6 text-white/58">
                Esta sessão fica limitada ao painel da plataforma.
              </p>
            </div>
            <SuperAdminLoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
