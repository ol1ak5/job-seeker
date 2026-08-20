import "@/app/cv.css";

import CvDocument from "@/components/CvDocument";
import PrintOnLoad from "@/components/PrintOnLoad";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "CV" };

/**
 * The CV alone on a page, with nothing else on it.
 *
 * The first attempt printed the dashboard and hid everything but the document
 * with `visibility: hidden`, which failed twice over: a hidden element still
 * occupies its space, so the page count was wrong, and pressing Ctrl+P without
 * using the button produced a blank sheet.
 *
 * A page that contains only the CV needs no trick. It paginates correctly
 * because there is nothing else to paginate, it obeys the @page margins, and
 * Ctrl+P does the same thing the button does. This is also exactly what
 * cv/make_pdf.sh feeds to Chrome, which is why the two come out alike.
 */
export default async function PrintCvPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const { data } = await supabase
    .from("cvs")
    .select("markdown, approved_markdown")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  return (
    <>
      <PrintOnLoad />
      <CvDocument markdown={data.approved_markdown ?? data.markdown} />
    </>
  );
}
