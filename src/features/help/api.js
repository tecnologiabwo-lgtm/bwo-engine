import { supabase, run } from "@/shared/lib/supabase";
export const listArticles = () => run(supabase.from("help_articles").select("*").order("section").order("sort"));
export const saveArticle = (a) => {
  const row = { slug: a.slug, section: a.section, title: a.title, summary: a.summary || "", body: a.body || "", audience: a.audience || "todos", sort: a.sort || 0, published: a.published !== false, updated_at: new Date().toISOString() };
  return a.id ? run(supabase.from("help_articles").update(row).eq("id", a.id)) : run(supabase.from("help_articles").insert(row));
};
export const deleteArticle = (id) => run(supabase.from("help_articles").delete().eq("id", id));
