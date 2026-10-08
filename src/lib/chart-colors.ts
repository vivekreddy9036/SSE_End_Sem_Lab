// Central palette for case-stage and case-age charts/badges.
// Recharts renders to SVG and needs literal color strings (not CSS var() refs),
// so these are hand-tuned to match the --stage-* / semantic tokens in globals.css.

export const STAGE_COLORS: Record<string, string> = {
  UI: "hsl(217, 91%, 60%)",
  PT: "hsl(38, 92%, 50%)",
  HC: "hsl(0, 84%, 60%)",
  SC: "hsl(270, 70%, 60%)",
};

export const PIE_FILLS = [STAGE_COLORS.UI, STAGE_COLORS.PT, STAGE_COLORS.HC, STAGE_COLORS.SC];

export const AGE_COLORS = [
  "hsl(142, 71%, 45%)", // green  - fresh
  "hsl(48, 96%, 53%)",  // yellow - moderate
  "hsl(25, 95%, 53%)",  // orange - aging
  "hsl(0, 72%, 51%)",   // red    - old
];

export const BRANCH_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(270, 70%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(340, 82%, 52%)",
];
