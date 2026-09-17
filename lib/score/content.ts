import { hasH1, hasMainLandmark, hasSpaShell, visibleText } from "./html";

export function assessRawHtml(html: string): {
  textLength: number;
  spaShell: boolean;
  level: "empty" | "thin" | "meaningful";
} {
  const text = visibleText(html);
  const spaShell = hasSpaShell(html);
  if (text.length < 50 || (spaShell && text.length < 200)) {
    return { textLength: text.length, spaShell, level: "empty" };
  }
  if (text.length < 200) {
    return { textLength: text.length, spaShell, level: "thin" };
  }
  return { textLength: text.length, spaShell, level: "meaningful" };
}

export function assessLandmarks(html: string): {
  h1: boolean;
  main: boolean;
} {
  return { h1: hasH1(html), main: hasMainLandmark(html) };
}
