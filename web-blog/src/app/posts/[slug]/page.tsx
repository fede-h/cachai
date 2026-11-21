import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchPublishedPostBySlug } from "@/lib/api";

export const dynamic = "force-dynamic";

interface PostPageProps {
  params: { slug: string };
}

export default async function PostDetailPage({ params }: PostPageProps) {
  const post = await fetchPublishedPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Link
          href="/"
          className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
        >
          &larr; Back to all reports
        </Link>
        {post.published_at && (
          <time
            dateTime={post.published_at}
            className="text-xs text-slate-400"
          >
            {new Date(post.published_at).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        )}
      </div>

      <div className="prose prose-invert prose-emerald max-w-none rounded-xl border border-slate-800 bg-slate-900/50 p-8">
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
          {post.markdown_body}
        </ReactMarkdown>
      </div>
    </article>
  );
}
