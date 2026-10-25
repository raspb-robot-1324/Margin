import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/");

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-5 py-16">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
        Accès propriétaire
      </p>
      <h1 className="mt-2 font-display text-5xl tracking-tight text-[var(--ink)]">
        Connexion à Margin
      </h1>
      <p className="mt-3 text-[var(--ink-soft)]">
        Lien magique par e-mail — pas de mot de passe. Les mentors n’ont pas
        besoin de compte : ils utilisent ton lien de partage.
      </p>
      <div className="mt-8">
        <LoginForm />
      </div>
    </div>
  );
}
