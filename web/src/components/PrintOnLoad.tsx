"use client";

import { useEffect } from "react";

/**
 * Open the print dialog as soon as the page is on screen.
 *
 * Waiting for fonts matters: Times New Roman decides where every justified
 * line breaks, and printing before it is ready measures the fallback face and
 * paginates against the wrong widths.
 */
export default function PrintOnLoad() {
  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) window.print();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
