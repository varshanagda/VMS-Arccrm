type VisitActionPageProps = {
  params: {
    visitId: string;
    action: string;
  };
  searchParams: {
    token?: string;
  };
};

// Use an internal URL for server-side fetches to avoid SSL certificate issues with self-signed certs
const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8005";

export const dynamic = "force-dynamic";

export default async function VisitActionPage({ params, searchParams }: VisitActionPageProps) {
  const action = params.action.toLowerCase();
  const token = searchParams.token;

  if (!["approve", "reject"].includes(action) || !token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-12">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Invalid approval link</h1>
          <p className="mt-3 text-sm text-slate-600">
            This host response link is missing required details or is not supported.
          </p>
        </div>
      </main>
    );
  }

  const backendUrl = `${API_BASE_URL}/visits/${encodeURIComponent(params.visitId)}/${action}?token=${encodeURIComponent(token)}`;

  try {
    const response = await fetch(backendUrl, {
      cache: "no-store",
    });

    const html = await response.text();

    if (!response.ok) {
      return (
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-12">
          <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-red-900">Unable to process request</h1>
            <p className="mt-3 text-sm text-red-700">
              {html || "The approval link is invalid, expired, or the backend is unavailable."}
            </p>
          </div>
        </main>
      );
    }

    return <iframe title={`visit-${action}`} srcDoc={html} className="h-screen w-full border-0" />;
  } catch {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-12">
        <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-red-900">Backend unavailable</h1>
          <p className="mt-3 text-sm text-red-700">
            The visitor approval service is not reachable right now. Make sure the backend is running on port 8005.
          </p>
        </div>
      </main>
    );
  }
}
