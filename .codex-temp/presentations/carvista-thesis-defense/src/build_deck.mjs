import fs from "node:fs/promises";
import path from "node:path";
import {
  Presentation,
  PresentationFile,
  auto,
  column,
  fill,
  fixed,
  fr,
  grid,
  grow,
  hug,
  panel,
  row,
  rule,
  shape,
  text,
  wrap,
} from "@oai/artifact-tool";
import { paint, stroke } from "@oai/artifact-tool/presentation-jsx";

const W = 1920;
const H = 1080;
const OUT = "output/output.pptx";
const PREVIEW_DIR = "scratch/previews";

const C = {
  bg: "#F1F5F9",
  bg2: "#EEF4FA",
  ink: "#0F172A",
  navy: "#1E3A8A",
  blue: "#2563EB",
  lightBlue: "#DBEAFE",
  muted: "#475569",
  border: "#E2E8F0",
  surface: "#FFFFFF",
  surface2: "#F8FBFF",
  soft: "#EFF6FF",
  green: "#10B981",
  amber: "#F59E0B",
  rose: "#F43F5E",
};

const FONT_HEAD = "Space Grotesk";
const FONT_BODY = "Inter";

const presentation = Presentation.create({
  slideSize: { width: W, height: H },
});

function compose(slide, node, frame) {
  slide.compose(node, { frame, baseUnit: 8 });
}

function bg(slide, variant = "default") {
  const base = variant === "cover" ? "#F8FBFF" : C.bg;
  compose(
    slide,
    shape({ name: "background", width: fill, height: fill, fill: paint(base) }),
    { left: 0, top: 0, width: W, height: H },
  );
  compose(
    slide,
    shape({
      name: "blue-glow-left",
      geometry: "ellipse",
      width: fill,
      height: fill,
      fill: paint("#E7F0FF"),
      line: stroke("0px #E7F0FF"),
    }),
    { left: -220, top: -180, width: 680, height: 520 },
  );
  compose(
    slide,
    shape({
      name: "cyan-glow-right",
      geometry: "ellipse",
      width: fill,
      height: fill,
      fill: paint("#EAF2FF"),
      line: stroke("0px #EAF2FF"),
    }),
    { left: 1380, top: -140, width: 620, height: 500 },
  );
}

const titleStyle = {
  typeface: FONT_HEAD,
  fontSize: 56,
  bold: true,
  color: C.ink,
  lineSpacing: 0.93,
};
const subtitleStyle = {
  typeface: FONT_BODY,
  fontSize: 25,
  color: C.muted,
  lineSpacing: 1.18,
};
const bodyStyle = {
  typeface: FONT_BODY,
  fontSize: 24,
  color: C.muted,
  lineSpacing: 1.16,
};
const smallStyle = {
  typeface: FONT_BODY,
  fontSize: 16,
  color: C.muted,
};

function t(slide, value, frame, style = bodyStyle, name = "text") {
  compose(
    slide,
    text(value, {
      name,
      width: fill,
      height: hug,
      style,
    }),
    frame,
  );
}

function title(slide, value, subtitle, slideNo) {
  compose(
    slide,
    column({ name: "title-stack", width: fill, height: hug, gap: 14 }, [
      text(value, { name: "slide-title", width: fill, height: hug, style: titleStyle }),
      subtitle
        ? text(subtitle, {
            name: "slide-subtitle",
            width: fill,
            height: hug,
            style: subtitleStyle,
          })
        : rule({ name: "title-rule", width: fixed(168), stroke: C.blue, weight: 4 }),
    ]),
    { left: 88, top: 64, width: 1540, height: 178 },
  );
  footer(slide, slideNo);
}

function footer(slide, slideNo) {
  compose(
    slide,
    row({ name: "footer", width: fill, height: hug, justify: "between", align: "center" }, [
      text("CarVista Thesis Defense", {
        name: "footer-left",
        width: hug,
        height: hug,
        style: { ...smallStyle, fontSize: 14, color: "#64748B" },
      }),
      text(String(slideNo).padStart(2, "0"), {
        name: "footer-number",
        width: hug,
        height: hug,
        style: { ...smallStyle, fontSize: 14, color: "#94A3B8", bold: true },
      }),
    ]),
    { left: 88, top: 1015, width: 1744, height: 28 },
  );
}

function cardNode(name, children, opts = {}) {
  return panel(
    {
      name,
      width: fill,
      height: fill,
      fill: paint(opts.fill || C.surface),
      line: stroke(opts.line || `1.4px ${C.border}`),
      borderRadius: opts.radius || 30,
      shadow: opts.shadow || "0px 20px 42px rgba(15,45,98,0.08)",
      padding: opts.padding || { x: 30, y: 26 },
      align: opts.align || "start",
      justify: opts.justify || "start",
    },
    children,
  );
}

function miniPill(label, color = C.blue) {
  const pillWidth = Math.min(360, Math.max(120, label.length * 11 + 44));
  return panel(
    {
      width: fixed(pillWidth),
      height: hug,
      fill: paint(C.lightBlue),
      line: stroke(`1px ${C.lightBlue}`),
      borderRadius: "rounded-full",
      padding: { x: 16, y: 8 },
    },
    text(label, {
      width: fill,
      height: hug,
      style: {
        typeface: FONT_BODY,
        fontSize: 15,
        bold: true,
        color,
        letterSpacing: 0.8,
        alignment: "center",
      },
    }),
  );
}

function iconBubble(label, color = C.blue) {
  return panel(
    {
      width: fixed(64),
      height: fixed(64),
      fill: paint("#EFF6FF"),
      line: stroke(`1px ${C.lightBlue}`),
      borderRadius: "rounded-full",
      align: "center",
      justify: "center",
      shadow: "0px 12px 24px rgba(37,99,235,0.10)",
    },
    text(label, {
      width: fixed(50),
      height: hug,
      style: {
        typeface: FONT_HEAD,
        fontSize: 24,
        bold: true,
        color,
        alignment: "center",
      },
    }),
  );
}

function featureCard(name, tag, heading, body, icon, accent = C.blue) {
  return cardNode(
    name,
    column({ width: fill, height: fill, gap: 16 }, [
      row({ width: fill, height: hug, align: "center", justify: "between" }, [
        iconBubble(icon, accent),
        miniPill(tag, accent),
      ]),
      text(heading, {
        width: fill,
        height: hug,
        style: {
          typeface: FONT_HEAD,
          fontSize: 30,
          bold: true,
          color: C.ink,
          lineSpacing: 1.02,
        },
      }),
      text(body, {
        width: fill,
        height: hug,
        style: { ...bodyStyle, fontSize: 20, lineSpacing: 1.2 },
      }),
    ]),
    { padding: { x: 28, y: 24 } },
  );
}

function bullets(items, size = 22) {
  return column(
    { name: "bullets", width: fill, height: hug, gap: 12 },
    items.map((item, i) =>
      row({ name: `bullet-${i + 1}`, width: fill, height: hug, gap: 12, align: "start" }, [
        shape({
          name: `bullet-dot-${i + 1}`,
          geometry: "ellipse",
          width: fixed(10),
          height: fixed(10),
          fill: paint(i % 2 ? "#60A5FA" : C.blue),
          line: stroke("0px #FFFFFF"),
        }),
        text(item, {
          name: `bullet-text-${i + 1}`,
          width: fill,
          height: hug,
          style: { ...bodyStyle, fontSize: size, lineSpacing: 1.12 },
        }),
      ]),
    ),
  );
}

function arrowLabel(label) {
  return panel(
    {
      width: fixed(44),
      height: fixed(30),
      borderRadius: "rounded-full",
      fill: paint("#EFF6FF"),
      line: stroke(`1px ${C.lightBlue}`),
      align: "center",
      justify: "center",
    },
    text(label, {
      width: fixed(34),
      height: hug,
      style: { typeface: FONT_HEAD, fontSize: 17, bold: true, color: C.blue, alignment: "center" },
    }),
  );
}

function nodeBox(label, sub = null, accent = C.blue) {
  return panel(
    {
      width: fill,
      height: hug,
      fill: paint(C.surface),
      line: stroke(`1.2px ${C.border}`),
      borderRadius: 24,
      padding: { x: 20, y: 16 },
      shadow: "0px 12px 24px rgba(15,45,98,0.06)",
    },
    row({ width: fill, height: hug, gap: 14, align: "center" }, [
      shape({
        geometry: "ellipse",
        width: fixed(14),
        height: fixed(14),
        fill: paint(accent),
        line: stroke("0px #FFFFFF"),
      }),
      column({ width: fill, height: hug, gap: 4 }, [
        text(label, {
          width: fill,
          height: hug,
          style: { typeface: FONT_HEAD, fontSize: 22, bold: true, color: C.ink },
        }),
        sub
          ? text(sub, {
              width: fill,
              height: hug,
              style: { typeface: FONT_BODY, fontSize: 15, color: C.muted },
            })
          : text("", { width: fixed(1), height: fixed(1), style: { fontSize: 1, color: "transparent" } }),
      ]),
    ]),
  );
}

function addCarSilhouette(slide, x, y, scale = 1, opacity = 1) {
  const blue = opacity < 0.9 ? "#DBEAFE" : "#CADDF8";
  const bright = opacity < 0.9 ? "#BFDBFE" : "#93C5FD";
  compose(
    slide,
    shape({ geometry: "roundRect", width: fill, height: fill, fill: paint(blue), line: stroke("0px #FFFFFF") }),
    { left: x, top: y + 120 * scale, width: 690 * scale, height: 130 * scale },
  );
  compose(
    slide,
    shape({ geometry: "trapezoid", width: fill, height: fill, fill: paint("#DCEBFF"), line: stroke("0px #FFFFFF") }),
    { left: x + 150 * scale, top: y + 36 * scale, width: 360 * scale, height: 150 * scale },
  );
  for (const dx of [130, 510]) {
    compose(
      slide,
      shape({ geometry: "ellipse", width: fill, height: fill, fill: paint("#AFC3E2"), line: stroke("0px #FFFFFF") }),
      { left: x + dx * scale, top: y + 205 * scale, width: 94 * scale, height: 94 * scale },
    );
    compose(
      slide,
      shape({ geometry: "ellipse", width: fill, height: fill, fill: paint("#F8FBFF"), line: stroke("0px #FFFFFF") }),
      { left: x + (dx + 22) * scale, top: y + 227 * scale, width: 50 * scale, height: 50 * scale },
    );
  }
  compose(
    slide,
    shape({ geometry: "ellipse", width: fill, height: fill, fill: paint(bright), line: stroke("0px #FFFFFF") }),
    { left: x + 610 * scale, top: y + 145 * scale, width: 44 * scale, height: 24 * scale },
  );
}

function addGlowNetwork(slide) {
  const points = [
    [1320, 290],
    [1500, 210],
    [1640, 370],
    [1420, 470],
    [1710, 555],
  ];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1) || 2;
    const height = Math.abs(y2 - y1) || 2;
    compose(
      slide,
      shape({
        geometry: "line",
        width: fill,
        height: fill,
        fill: paint(C.bg),
        line: stroke("2px #BFDBFE"),
      }),
      { left, top, width, height },
    );
  }
  points.forEach(([x, y], i) => {
    compose(
      slide,
      shape({
        geometry: "ellipse",
        width: fill,
        height: fill,
        fill: paint(i === 0 ? C.blue : "#60A5FA"),
        line: stroke(`5px ${C.lightBlue}`),
      }),
      { left: x - 14, top: y - 14, width: 28, height: 28 },
    );
  });
}

function addCover() {
  const slide = presentation.slides.add();
  bg(slide, "cover");
  addCarSilhouette(slide, 1045, 520, 0.86, 1);
  addGlowNetwork(slide);
  compose(
    slide,
    column({ width: fill, height: hug, gap: 28 }, [
      row({ width: hug, height: hug, gap: 12, align: "center" }, [
        miniPill("CARVISTA", C.navy),
        miniPill("AI-POWERED CAR PLATFORM", C.blue),
      ]),
      text("CarVista: AI-Powered Intelligent Car Platform", {
        name: "cover-title",
        width: wrap(1030),
        height: hug,
        style: {
          typeface: FONT_HEAD,
          fontSize: 76,
          bold: true,
          color: C.ink,
          lineSpacing: 0.91,
        },
      }),
      text(
        "A full-stack automotive platform with AI-assisted comparison, price outlook, advisor chat, and ownership cost analysis",
        {
          name: "cover-subtitle",
          width: wrap(980),
          height: hug,
          style: { ...subtitleStyle, fontSize: 28, lineSpacing: 1.16 },
        },
      ),
    ]),
    { left: 104, top: 142, width: 1120, height: 520 },
  );
  compose(
    slide,
    panel(
      {
        name: "cover-footer-shell",
        width: fill,
        height: hug,
        fill: paint(C.surface),
        line: stroke(`1px ${C.border}`),
        borderRadius: "rounded-full",
        padding: { x: 26, y: 15 },
        shadow: "0px 14px 28px rgba(15,45,98,0.08)",
      },
      text("Bachelor Thesis Defense | School of Computer Science and Engineering", {
        name: "cover-footer",
        width: fill,
        height: hug,
        style: { typeface: FONT_HEAD, fontSize: 18, bold: true, color: C.navy, alignment: "center" },
      }),
    ),
    { left: 104, top: 914, width: 980, height: 76 },
  );
}

function addProblem() {
  const slide = presentation.slides.add();
  bg(slide);
  title(slide, "Problem Statement", "Car buying decisions are fragmented and hard to compare consistently.", 2);
  t(
    slide,
    "Buyers often move between vehicle specs, listings, reviews, price history, ownership cost, and seller information before they can make a confident decision.",
    { left: 92, top: 228, width: 1180, height: 90 },
    { ...bodyStyle, fontSize: 28, color: C.ink, lineSpacing: 1.14 },
    "problem-main",
  );
  compose(
    slide,
    grid({ width: fill, height: fill, columns: [fr(1), fr(1), fr(1)], columnGap: 28 }, [
      featureCard("pain-1", "01", "Scattered vehicle information", "Specs, images, reviews, and market signals live in separate places.", "I"),
      featureCard("pain-2", "02", "Hard-to-compare listings", "Listings vary by seller detail, price context, condition, and availability.", "C"),
      featureCard("pain-3", "03", "Unclear ownership cost", "Long-term taxes, depreciation, fuel, and maintenance are difficult to estimate.", "T"),
    ]),
    { left: 92, top: 420, width: 1736, height: 405 },
  );
  compose(
    slide,
    panel(
      {
        width: fill,
        height: hug,
        fill: paint("#EAF2FF"),
        line: stroke(`1px ${C.lightBlue}`),
        borderRadius: 28,
        padding: { x: 32, y: 22 },
      },
      text("CarVista turns these disconnected steps into one structured decision flow.", {
        width: fill,
        height: hug,
        style: { typeface: FONT_HEAD, fontSize: 30, bold: true, color: C.navy, alignment: "center" },
      }),
    ),
    { left: 372, top: 860, width: 1176, height: 78 },
  );
}

function addObjectives() {
  const slide = presentation.slides.add();
  bg(slide);
  title(slide, "Project Objectives", "A practical full-stack platform with structured data and AI-assisted decision support.", 3);
  const objectives = [
    ["01", "Full-stack catalog and marketplace", "Search, inspect, list, and manage vehicles from one product surface."],
    ["02", "Buyer and seller workflows", "Save cars, create listings, upload photos, request viewings, and manage status."],
    ["03", "AI-assisted decision support", "Advisor chat, comparison, price outlook, and ownership-cost guidance."],
    ["04", "Grounded backend calculations", "Calculations and scores are derived from structured services and database records."],
  ];
  compose(
    slide,
    grid({ width: fill, height: fill, columns: [fr(1), fr(1)], rows: [fr(1), fr(1)], columnGap: 28, rowGap: 28 }, 
      objectives.map(([num, head, bodyText]) =>
        cardNode(
          `objective-${num}`,
          row({ width: fill, height: fill, gap: 24, align: "start" }, [
            iconBubble(num, C.blue),
            column({ width: fill, height: hug, gap: 12 }, [
              text(head, { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 31, bold: true, color: C.ink } }),
              text(bodyText, { width: fill, height: hug, style: { ...bodyStyle, fontSize: 22 } }),
            ]),
          ]),
          { padding: { x: 30, y: 28 } },
        ),
      )
    ),
    { left: 120, top: 260, width: 1680, height: 600 },
  );
}

function addOverview() {
  const slide = presentation.slides.add();
  bg(slide);
  title(slide, "CarVista System Overview", "One integrated platform for car research, marketplace actions, and intelligent guidance.", 4);
  const nodes = [
    [190, 270, "Catalog browsing", "Vehicle specs and media"],
    [605, 258, "Marketplace listings", "Live seller inventory"],
    [1125, 258, "Seller workflow", "Create and manage listings"],
    [1530, 285, "Saved listings", "Garage/watchlist"],
    [200, 716, "Reviews", "Car and seller feedback"],
    [570, 790, "AI advisor", "Intent-aware chat"],
    [1020, 790, "Smart comparison", "Scores and trade-offs"],
    [1395, 715, "Price outlook + TCO", "Market and ownership panels"],
  ];
  nodes.forEach(([x, y, label, sub], i) => {
    compose(slide, nodeBox(label, sub, i % 2 ? C.navy : C.blue), { left: x, top: y, width: 330, height: 92 });
    const cx = x + 165;
    const cy = y + 46;
    const centerX = 960;
    const centerY = 535;
    compose(
      slide,
      shape({
        geometry: "line",
        width: fill,
        height: fill,
        fill: paint(C.bg),
        line: stroke("2px #DBEAFE"),
      }),
      { left: Math.min(cx, centerX), top: Math.min(cy, centerY), width: Math.abs(centerX - cx) || 1, height: Math.abs(centerY - cy) || 1 },
    );
  });
  compose(
    slide,
    cardNode(
      "central-carvista",
      column({ width: fill, height: fill, align: "center", justify: "center", gap: 18 }, [
        text("CarVista", {
          width: fill,
          height: hug,
          style: { typeface: FONT_HEAD, fontSize: 54, bold: true, color: C.navy, alignment: "center" },
        }),
        text("Catalog + Marketplace + AI Insight Layer", {
          width: fill,
          height: hug,
          style: { ...subtitleStyle, fontSize: 22, alignment: "center" },
        }),
      ]),
      { fill: "#FFFFFF", radius: 40, padding: { x: 36, y: 30 } },
    ),
    { left: 672, top: 390, width: 576, height: 300 },
  );
}

function addTechStack() {
  const slide = presentation.slides.add();
  bg(slide);
  title(slide, "Technology Stack", "Layered implementation choices for frontend, backend, data, AI, and deployment readiness.", 5);
  const layers = [
    ["Frontend", "Next.js, React, TypeScript, Tailwind CSS", "#2563EB"],
    ["Backend", "Node.js, Express", "#1E3A8A"],
    ["Database", "MySQL, Sequelize ORM", "#0F766E"],
    ["AI", "Qwen3-32B via FPT AI Factory / OpenAI-compatible adapter", "#7C3AED"],
    ["Data support", "Python scripts for seed and ingestion", "#0891B2"],
    ["Deployment prep", "Render / Vercel / Railway cloud-ready setup", "#64748B"],
  ];
  compose(
    slide,
    column(
      { width: fill, height: fill, gap: 16 },
      layers.map(([label, detail, accent], i) =>
        row({ width: fill, height: fixed(88), align: "center", gap: 22 }, [
          panel(
            {
              width: fixed(250),
              height: fill,
              fill: paint(i === 0 ? C.blue : C.surface),
              line: stroke(i === 0 ? "0px #2563EB" : `1px ${C.border}`),
              borderRadius: 26,
              padding: { x: 24, y: 22 },
              align: "center",
              justify: "center",
              shadow: "0px 14px 28px rgba(15,45,98,0.07)",
            },
            text(label, {
              width: fill,
              height: hug,
              style: { typeface: FONT_HEAD, fontSize: 24, bold: true, color: i === 0 ? "#FFFFFF" : accent, alignment: "center" },
            }),
          ),
          panel(
            {
              width: fill,
              height: fill,
              fill: paint("#FFFFFF"),
              line: stroke(`1px ${C.border}`),
              borderRadius: 26,
              padding: { x: 28, y: 22 },
              justify: "center",
            },
            text(detail, {
              width: fill,
              height: hug,
              style: { typeface: FONT_BODY, fontSize: 25, color: C.ink, bold: i <= 1 },
            }),
          ),
        ]),
      ),
    ),
    { left: 150, top: 245, width: 1620, height: 620 },
  );
}

function addArchitecture() {
  const slide = presentation.slides.add();
  bg(slide);
  title(slide, "System Architecture", "Backend services calculate and validate; Qwen3 turns grounded results into buyer-friendly insight.", 6);
  const stages = [
    ["User Interface", "Next.js product screens"],
    ["Backend API", "Express routes + auth"],
    ["Domain Services", "Scores, estimates, validation"],
    ["Database", "MySQL + Sequelize models"],
    ["AI Insight Layer", "Prompts, routing, formatting"],
    ["Qwen3-32B", "Reasoning and explanation"],
  ];
  compose(
    slide,
    row(
      { width: fill, height: hug, gap: 10, align: "center" },
      stages.flatMap(([label, sub], i) => {
        const node = panel(
          {
            width: fixed(i === 4 ? 236 : 216),
            height: fixed(144),
            fill: paint(i >= 4 ? "#EFF6FF" : C.surface),
            line: stroke(i >= 4 ? `1.5px ${C.lightBlue}` : `1.2px ${C.border}`),
            borderRadius: 28,
            padding: { x: 22, y: 22 },
            shadow: "0px 18px 34px rgba(15,45,98,0.08)",
            justify: "center",
          },
          column({ width: fill, height: hug, gap: 8 }, [
            text(label, { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 24, bold: true, color: i >= 4 ? C.blue : C.ink, alignment: "center" } }),
            text(sub, { width: fill, height: hug, style: { typeface: FONT_BODY, fontSize: 16, color: C.muted, alignment: "center" } }),
          ]),
        );
        return i < stages.length - 1 ? [node, arrowLabel(">")] : [node];
      }),
    ),
    { left: 92, top: 310, width: 1740, height: 160 },
  );
  compose(
    slide,
    grid({ width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 30 }, [
      cardNode(
        "backend-note",
        column({ width: fill, height: hug, gap: 18 }, [
          miniPill("SOURCE OF TRUTH", C.navy),
          text("Backend responsibilities", { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 34, bold: true, color: C.ink } }),
          bullets(["Calculates scores, estimates, taxes, and totals", "Validates request inputs and ownership rules", "Stores catalog, marketplace, review, and AI session data"], 22),
        ]),
        { padding: { x: 34, y: 30 } },
      ),
      cardNode(
        "qwen-note",
        column({ width: fill, height: hug, gap: 18 }, [
          miniPill("EXPLANATION LAYER", C.blue),
          text("Qwen3 responsibilities", { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 34, bold: true, color: C.ink } }),
          bullets(["Explains trade-offs and market signals", "Summarizes structured outputs in natural language", "Asks focused follow-up questions and formats guidance"], 22),
        ]),
        { padding: { x: 34, y: 30 } },
      ),
    ]),
    { left: 160, top: 585, width: 1600, height: 315 },
  );
}

function workflowLane(titleText, steps, accent) {
  return cardNode(
    `${titleText.toLowerCase()}-lane`,
    column({ width: fill, height: fill, gap: 24 }, [
      row({ width: fill, height: hug, gap: 16, align: "center" }, [
        iconBubble(titleText[0], accent),
        text(titleText, { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 34, bold: true, color: C.ink } }),
      ]),
      row(
        { width: fill, height: hug, gap: 14, align: "center" },
        steps.flatMap((step, i) => {
          const node = panel(
            {
              width: fixed(190),
              height: fixed(104),
              fill: paint(i === 0 ? "#EAF2FF" : C.surface),
              line: stroke(`1px ${C.border}`),
              borderRadius: 22,
              padding: { x: 16, y: 16 },
              align: "center",
              justify: "center",
            },
            text(step, {
              width: fill,
              height: hug,
              style: { typeface: FONT_BODY, fontSize: 18, bold: true, color: C.ink, alignment: "center", lineSpacing: 1.08 },
            }),
          );
          return i < steps.length - 1 ? [node, arrowLabel(">")] : [node];
        }),
      ),
    ]),
    { padding: { x: 34, y: 28 } },
  );
}

function addWorkflows() {
  const slide = presentation.slides.add();
  bg(slide);
  title(slide, "Core User Workflows", "Buyer and seller paths connect marketplace activity with catalog and AI guidance.", 7);
  compose(
    slide,
    column({ width: fill, height: fill, gap: 32 }, [
      workflowLane("Buyer", ["Browse catalog", "View listing", "Save car", "Compare cars", "Ask AI advisor", "Send viewing request"], C.blue),
      workflowLane("Seller", ["Create listing", "Upload images", "Manage listings", "Receive viewing requests", "Update status"], C.navy),
    ]),
    { left: 96, top: 260, width: 1728, height: 630 },
  );
}

function addAi12() {
  const slide = presentation.slides.add();
  bg(slide);
  title(slide, "AI-Assisted Comparison and Price Outlook", "Structured backend signals become clear explanations for buyer decisions.", 8);
  compose(
    slide,
    grid({ width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 34 }, [
      cardNode(
        "comparison-card",
        column({ width: fill, height: fill, gap: 20 }, [
          row({ width: fill, height: hug, justify: "between", align: "center" }, [iconBubble("01"), miniPill("COMPARISON")]),
          text("Backend compares specs, prices, reviews, and scores.", { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 34, bold: true, color: C.ink, lineSpacing: 1.02 } }),
          bullets(["Scores value, practicality, safety, comfort, efficiency, resale, and fit", "Qwen3 explains strengths, weaknesses, and final verdict", "No invented cars, prices, or specs outside grounded payloads"], 21),
          panel(
            {
              width: fill,
              height: fixed(112),
              fill: paint("#EFF6FF"),
              line: stroke(`1px ${C.lightBlue}`),
              borderRadius: 24,
              padding: { x: 24, y: 18 },
            },
            row({ width: fill, height: fill, align: "center", gap: 20 }, [
              text("Score", { width: fixed(110), height: hug, style: { typeface: FONT_HEAD, fontSize: 22, bold: true, color: C.blue } }),
              shape({ geometry: "roundRect", width: fixed(320), height: fixed(16), fill: paint(C.blue), line: stroke("0px #2563EB") }),
              text("Verdict", { width: fill, height: hug, style: { typeface: FONT_BODY, fontSize: 20, bold: true, color: C.ink } }),
            ]),
          ),
        ]),
        { padding: { x: 34, y: 30 } },
      ),
      cardNode(
        "price-outlook-card",
        column({ width: fill, height: fill, gap: 20 }, [
          row({ width: fill, height: hug, justify: "between", align: "center" }, [iconBubble("02"), miniPill("PRICE OUTLOOK")]),
          text("Backend calculates trend indicators from market data.", { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 34, bold: true, color: C.ink, lineSpacing: 1.02 } }),
          bullets(["Uses price history, active listings, depreciation, and scarcity signals", "Qwen3 explains market signals, risk, and buyer advice", "Presented as an estimate, not a guaranteed prediction"], 21),
          panel(
            {
              width: fill,
              height: fixed(112),
              fill: paint("#EFF6FF"),
              line: stroke(`1px ${C.lightBlue}`),
              borderRadius: 24,
              padding: { x: 24, y: 18 },
            },
            row({ width: fill, height: fill, align: "center", gap: 18 }, [
              shape({ geometry: "line", width: fixed(260), height: fixed(70), fill: paint("#EFF6FF"), line: stroke("5px #2563EB") }),
              column({ width: fill, height: hug, gap: 4 }, [
                text("Trend + range", { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 22, bold: true, color: C.blue } }),
                text("Confidence and caveats travel with the answer.", { width: fill, height: hug, style: { typeface: FONT_BODY, fontSize: 17, color: C.muted } }),
              ]),
            ]),
          ),
        ]),
        { padding: { x: 34, y: 30 } },
      ),
    ]),
    { left: 120, top: 250, width: 1680, height: 660 },
  );
}

function addAi34() {
  const slide = presentation.slides.add();
  bg(slide);
  title(slide, "AI Advisor and TCO Analysis", "A conversational entry point routes users to grounded services and practical cost explanations.", 9);
  compose(
    slide,
    grid({ width: fill, height: fill, columns: [fr(0.9), fr(1.1)], columnGap: 34 }, [
      cardNode(
        "advisor-chat",
        column({ width: fill, height: fill, gap: 18 }, [
          row({ width: fill, height: hug, justify: "between", align: "center" }, [iconBubble("03"), miniPill("AI ADVISOR")]),
          text("Intent-aware concierge", { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 34, bold: true, color: C.ink } }),
          bullets(["Extracts preferences and missing fields", "Asks one focused follow-up question", "Routes to recommendation, comparison, price outlook, or TCO services"], 21),
          panel(
            {
              width: fill,
              height: fixed(176),
              fill: paint("#FFFFFF"),
              line: stroke(`1px ${C.lightBlue}`),
              borderRadius: 30,
              padding: { x: 24, y: 22 },
              shadow: "0px 14px 30px rgba(15,45,98,0.08)",
            },
            column({ width: fill, height: hug, gap: 12 }, [
              text("I need a bit more detail before I can route this confidently.", { width: fill, height: hug, style: { typeface: FONT_BODY, fontSize: 19, color: C.ink } }),
              text("What budget range should I optimize for?", { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 22, bold: true, color: C.blue } }),
            ]),
          ),
        ]),
        { padding: { x: 34, y: 30 } },
      ),
      cardNode(
        "tco-card",
        column({ width: fill, height: fill, gap: 18 }, [
          row({ width: fill, height: hug, justify: "between", align: "center" }, [iconBubble("04"), miniPill("TCO ANALYSIS")]),
          text("Backend calculates ownership cost components.", { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 34, bold: true, color: C.ink } }),
          bullets(["Taxes, insurance, maintenance, depreciation, and fuel/energy", "Annual and monthly averages over selected ownership years", "Qwen3 explains cost drivers and practical advice"], 21),
          grid({ width: fill, height: fixed(172), columns: [fr(1), fr(1), fr(1)], columnGap: 12 }, [
            costBar("Tax", "22%", C.blue),
            costBar("Depreciation", "34%", C.navy),
            costBar("Running", "18%", "#0F766E"),
          ]),
        ]),
        { padding: { x: 34, y: 30 } },
      ),
    ]),
    { left: 120, top: 245, width: 1680, height: 675 },
  );
}

function costBar(label, value, color) {
  return panel(
    {
      width: fill,
      height: fill,
      fill: paint("#F8FBFF"),
      line: stroke(`1px ${C.border}`),
      borderRadius: 24,
      padding: { x: 16, y: 12 },
      justify: "end",
    },
    column({ width: fill, height: fill, gap: 6, justify: "end" }, [
      shape({ geometry: "roundRect", width: fill, height: fixed(label === "Depreciation" ? 70 : label === "Tax" ? 50 : 38), fill: paint(color), line: stroke("0px #FFFFFF") }),
      text(value, { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 22, bold: true, color, alignment: "center" } }),
      text(label, { width: fill, height: hug, style: { typeface: FONT_BODY, fontSize: 14, color: C.muted, alignment: "center" } }),
    ]),
  );
}

function uiMock(titleText, items, accent = C.blue) {
  return panel(
    {
      width: fill,
      height: fill,
      fill: paint("#FFFFFF"),
      line: stroke(`1px ${C.border}`),
      borderRadius: 30,
      padding: { x: 24, y: 22 },
      shadow: "0px 18px 36px rgba(15,45,98,0.10)",
    },
    column({ width: fill, height: fill, gap: 12 }, [
      row({ width: fill, height: hug, align: "center", justify: "between" }, [
        text(titleText, { width: hug, height: hug, style: { typeface: FONT_HEAD, fontSize: 24, bold: true, color: C.ink } }),
        shape({ geometry: "ellipse", width: fixed(18), height: fixed(18), fill: paint(accent), line: stroke("0px #FFFFFF") }),
      ]),
      ...items.map((item, i) =>
        panel(
          {
            width: fill,
            height: fixed(50),
            fill: paint(i % 2 ? "#EFF6FF" : "#F8FAFC"),
            line: stroke(`1px ${C.border}`),
            borderRadius: 18,
            padding: { x: 16, y: 12 },
          },
          text(item, { width: fill, height: hug, style: { typeface: FONT_BODY, fontSize: 17, color: i === 0 ? C.ink : C.muted, bold: i === 0 } }),
        ),
      ),
    ]),
  );
}

function addResults() {
  const slide = presentation.slides.add();
  bg(slide);
  title(slide, "Implementation Results", "Major product and API outcomes are implemented across the current CarVista codebase.", 10);
  compose(
    slide,
    grid({ width: fill, height: fill, columns: [fr(1), fr(1), fr(1)], rows: [fr(1), fr(1)], columnGap: 22, rowGap: 22 }, [
      uiMock("Catalog", ["Browse variants", "Specs + reviews", "Price history panel"]),
      uiMock("Marketplace", ["Create listing", "Upload images", "Manage status"], C.navy),
      uiMock("Saved Cars", ["Save listings", "Garage view", "Sort saved inventory"], "#0F766E"),
      uiMock("Requests", ["Send viewing request", "Inbox / outbox", "Seller notifications"], "#0891B2"),
      uiMock("AI Panels", ["Assistant chat", "Comparison verdict", "Price outlook + TCO"], "#7C3AED"),
      uiMock("API Docs", ["Swagger/OpenAPI", "Auth-protected routes", "Service-level tests"], "#64748B"),
    ]),
    { left: 112, top: 245, width: 1696, height: 660 },
  );
}

function addEvaluation() {
  const slide = presentation.slides.add();
  bg(slide);
  title(slide, "Evaluation and Limitations", "The project is validated through implementation scenarios, with clear next validation gaps.", 11);
  compose(
    slide,
    grid({ width: fill, height: fill, columns: [fr(1), fr(1), fr(1)], columnGap: 28 }, [
      cardNode(
        "completed",
        column({ width: fill, height: hug, gap: 20 }, [
          miniPill("COMPLETED", "#0F766E"),
          text("Validation approach", { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 34, bold: true, color: C.ink } }),
          bullets(["Implementation-based scenarios", "Feature completion mapping", "Service-level testing", "Swagger API inspection"], 21),
        ]),
        { padding: { x: 32, y: 30 } },
      ),
      cardNode(
        "limited",
        column({ width: fill, height: hug, gap: 20 }, [
          miniPill("LIMITED", "#B45309"),
          text("Current limits", { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 34, bold: true, color: C.ink } }),
          bullets(["No formal user study yet", "Prediction accuracy not yet validated", "Some admin, notification, and moderation UI areas are partial"], 21),
        ]),
        { padding: { x: 32, y: 30 } },
      ),
      cardNode(
        "future",
        column({ width: fill, height: hug, gap: 20 }, [
          miniPill("FUTURE", C.blue),
          text("What needs expansion", { width: fill, height: hug, style: { typeface: FONT_HEAD, fontSize: 34, bold: true, color: C.ink } }),
          bullets(["Broader market data coverage", "Better price outlook validation", "Production monitoring for AI answer quality"], 21),
        ]),
        { padding: { x: 32, y: 30 } },
      ),
    ]),
    { left: 120, top: 280, width: 1680, height: 560 },
  );
  compose(
    slide,
    panel(
      {
        width: fill,
        height: hug,
        fill: paint("#FFFFFF"),
        line: stroke(`1px ${C.border}`),
        borderRadius: 28,
        padding: { x: 34, y: 22 },
      },
      text("Balanced thesis position: CarVista demonstrates working integration; empirical user and prediction validation remain future work.", {
        width: fill,
        height: hug,
        style: { typeface: FONT_HEAD, fontSize: 25, bold: true, color: C.navy, alignment: "center" },
      }),
    ),
    { left: 260, top: 880, width: 1400, height: 82 },
  );
}

function addConclusion() {
  const slide = presentation.slides.add();
  bg(slide, "cover");
  title(slide, "Conclusion and Future Work", null, 12);
  t(
    slide,
    "CarVista demonstrates a working full-stack automotive platform that connects catalog data, marketplace workflows, and AI-assisted decision support.",
    { left: 105, top: 230, width: 1250, height: 110 },
    { typeface: FONT_HEAD, fontSize: 36, bold: true, color: C.ink, lineSpacing: 1.08 },
    "conclusion-summary",
  );
  compose(
    slide,
    grid({ width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 34 }, [
      cardNode(
        "future-work",
        column({ width: fill, height: hug, gap: 18 }, [
          miniPill("FUTURE WORK", C.blue),
          bullets(["Improve market data coverage", "Add formal user testing", "Improve price outlook validation", "Complete admin and notification UI", "Improve AI answer quality and monitoring", "Prepare production deployment"], 22),
        ]),
        { padding: { x: 34, y: 30 } },
      ),
      cardNode(
        "closing-line",
        column({ width: fill, height: fill, justify: "center", gap: 22 }, [
          text("CarVista helps users move from car information to car decisions with clearer data and AI-assisted guidance.", {
            width: fill,
            height: hug,
            style: { typeface: FONT_HEAD, fontSize: 41, bold: true, color: C.navy, lineSpacing: 1.02 },
          }),
          rule({ width: fixed(220), stroke: C.blue, weight: 5 }),
          text("Thank you.", { width: fill, height: hug, style: { typeface: FONT_BODY, fontSize: 26, color: C.muted } }),
        ]),
        { fill: "#FFFFFF", radius: 40, padding: { x: 42, y: 38 } },
      ),
    ]),
    { left: 104, top: 410, width: 1712, height: 470 },
  );
  addCarSilhouette(slide, 1180, 805, 0.62, 0.8);
}

addCover();
addProblem();
addObjectives();
addOverview();
addTechStack();
addArchitecture();
addWorkflows();
addAi12();
addAi34();
addResults();
addEvaluation();
addConclusion();

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.mkdir(PREVIEW_DIR, { recursive: true });
const deck = await PresentationFile.exportPptx(presentation);
await deck.save(OUT);

// Render from the saved PPTX, not only from the in-memory presentation, for parity.
const savedBytes = await fs.readFile(OUT);
const imported = await PresentationFile.importPptx(savedBytes);
for (let i = 0; i < imported.slides.count; i += 1) {
  const slide = imported.slides.getItem(i);
  const png = await slide.export({ format: "png" });
  await fs.writeFile(path.join(PREVIEW_DIR, `slide-${String(i + 1).padStart(2, "0")}.png`), Buffer.from(await png.arrayBuffer()));
}

const inspect = await imported.inspect({ kind: "textbox,shape,image,chart,table,slide", maxChars: 200000 });
await fs.writeFile("scratch/inspect.ndjson", inspect.ndjson, "utf8");
await fs.writeFile(
  "scratch/qa-summary.json",
  JSON.stringify(
    {
      slideCount: imported.slides.count,
      output: path.resolve(OUT),
      previewDir: path.resolve(PREVIEW_DIR),
      pptxReimportRendered: true,
      inspectTruncated: inspect.truncated,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`Exported ${OUT}`);
console.log(`Rendered ${imported.slides.count} saved-PPTX previews to ${PREVIEW_DIR}`);
