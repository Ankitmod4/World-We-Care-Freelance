/**
 * Themes.
 *
 * Twelve palettes, each with a complete LIGHT and DARK set.
 *
 * WHAT IS THEMED, AND WHAT IS NOT (this changed — read note 5):
 * brand, accent and their soft/tint/ink variants are themed. The
 * NEUTRALS ARE NOT. In light mode all twelve share one grey ramp,
 * taken from DazzlingDish so the two products sit on the same paper.
 *
 * An earlier version themed the neutrals too — every palette had its
 * own tinted borders, faintly warm greys, warm off-whites in light
 * (#f9f6f2 and friends) and near-neutral near-blacks in dark. That
 * was a deliberate position, and it was reversed deliberately:
 * Robert asked for parity with DazzlingDish. If you are wondering why
 * the doc below argues so hard for warm light greys and untinted dark
 * ones, this is why — the arguments were sound, they lost to a
 * product decision.
 *
 * THREE THINGS THAT ARE NOT OBVIOUS:
 *
 *  1. EVERY VALUE HERE WAS CONTRAST-CHECKED, and there is a test that
 *     re-checks them. They were generated in OKLCH so they are
 *     perceptually consistent with each other, then verified pair by
 *     pair against WCAG AA. Editing a hex by hand is fine — the test
 *     will tell you if it stopped being readable.
 *
 *  2. NO NEUTRAL IS THEMED, IN EITHER MODE. All twelve palettes
 *     share one ramp in light (slate: page #f8fafc, card #ffffff,
 *     hover #f1f5f9) and one in dark (DD's navy: page #0b0d14, card
 *     #161a26, hover #232838). Brand and accent are the only things
 *     that tell the twelve apart, in both modes.
 *
 *  4. "ON" TOKENS EXIST BECAUSE FILLS INVERT. In light mode a brand
 *     button is dark and its label is white. In dark mode the same
 *     button is a PALE blue and white on it fails AA. Every solid
 *     fill therefore carries its own label colour — never assume
 *     white. The check script enforces this; it is what found the
 *     bug in the first place.
 *
 *  5. NO LIGHT NEUTRAL IS THEMED. `surface`, `surfaceMuted`,
 *     `surfaceHover`, `ground`, all three borders and all three text
 *     tones hold one shared value across every palette, and that
 *     value is DazzlingDish's:
 *
 *       ground / surfaceMuted  #f8fafc   slate-50   the page
 *       surface                #ffffff              a card on it
 *       surfaceHover           #f1f5f9   slate-100  a hovered row
 *       border                 #e2e8f0   slate-200
 *       borderSoft             #f1f5f9   slate-100
 *       borderStrong           #c8d2df   ~slate-300, see below
 *       text                   #0f172a   slate-900
 *       textMuted              #64748b   slate-500
 *       textSubtle             #7e8da3   between 400 and 500, see below
 *
 *     TWO OF DD'S VALUES DID NOT SURVIVE UNCHANGED, and it is worth
 *     knowing why before "fixing" them back. DD's slate-300 border
 *     (#cbd5e1) scores 1.48 against white where check-theme-contrast
 *     demands 1.5, and its faintest grey (#94a3b8) scores 2.56 where
 *     the script demands 3.0 — WWC enforces a floor DD does not.
 *     Both were darkened by the smallest step that clears it. Every
 *     other value above is DD's, to the hex.
 *
 *     WHAT THIS COSTS. `surfaceMuted` used to be themed just enough
 *     to matter — Grounded put mint behind an uploaded photo, Citron
 *     yellow behind the page. That is gone, and so is the warmth the
 *     old greys carried. In light mode the twelve themes are now told
 *     apart by brand and accent alone.
 *
 *     THE DARK SET IS DD'S TOO, and shares the same shape:
 *
 *       ground                 #0b0d14   the page
 *       surface                #161a26   a card on it — LIGHTER than
 *                                        the page, which is the whole
 *                                        trick that stops a dark UI
 *                                        reading as a flat black slab
 *       surfaceMuted           #1c2030   DD's bg-muted
 *       surfaceHover / border  #232838   DD uses one value for both,
 *                                        so a hovered row's border
 *                                        disappears into its fill
 *       borderSoft             #1c2030
 *       borderStrong           #343a58   DD's #303654, see below
 *       text                   #e2e8f0
 *       textMuted              #94a3b8
 *       textSubtle             #64748b   slate-500, see below
 *
 *     Same two exceptions as light, for the same reason — WWC's
 *     contrast script has floors DD does not. DD's #303654 scores
 *     1.47 against the card where 1.5 is required, so it was
 *     lightened by the smallest step that clears it (1.56). And DD
 *     ships only two dark text tones where WWC needs three, so
 *     `textSubtle` is slate-500, which clears the 3.0 floor at 3.40.
 *
 *     ONE VALUE SITS ON THE LINE: border #232838 against card
 *     #161a26 is 1.1837, and the floor is 1.18. It passes, but a
 *     "tidy-up" that rounds either hex will break the build. If you
 *     need to move it, move it lighter.
 *
 *     THE DARK NEUTRALS ARE NAVY, NOT GREY — channel spread runs 9 at
 *     the page to 36 at borderStrong. The old ones sat at 2, and the
 *     argument for that was sound: at L≈0.02 a hue in the neutrals is
 *     visible, and a tinted near-black fights a themed card. What
 *     defuses it is that nothing is themed any more. A navy page under
 *     a navy card has nothing to argue with; the same navy page under
 *     Meadow's old green card would have. If you ever re-theme
 *     `surface`, this is the first thing that will look wrong.
 *
 *     The light values match globals.css exactly, so a signed-out
 *     page and a themed one sit on the same paper. globals.css holds
 *     no dark colours at all — dark applies only where SiteShell has
 *     rendered #app-shell, so the values above are the only source.
 *     Keep them in step if you edit either.
 *
 *  3. STATUS COLOURS ARE NOT THEMED. Success, warning and danger are
 *     the same in all of them, because an error that has been re-hued
 *     to match a pink theme stops reading as an error.
 */

export type AppearanceMode = "light" | "dark" | "system";

export interface ThemeTokens {
  brand: string;
  brandHover: string;
  /** Label colour for text sitting ON the brand fill. See note 4. */
  onBrand: string;
  brandSoft: string;
  brandTint: string;
  brandInk: string;
  accent: string;
  accentSoft: string;
  /** Label colour for text sitting ON the accent fill. */
  onAccent: string;
  accentInk: string;
  /** A card on the ground. Themed, but barely — see note 5. */
  surface: string;
  /** NOT themed — see note 5. */
  surfaceMuted: string;
  /** NOT themed — see note 5. */
  surfaceHover: string;
  border: string;
  borderSoft: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  /**
   * The page behind everything. NOT themed — see note 5. Same warm
   * off-white / warm near-black in every palette.
   */
  ground: string;
}

export interface Theme {
  id: string;
  name: string;
  blurb: string;
  light: ThemeTokens;
  dark: ThemeTokens;
}

export const THEMES: Theme[] = [
  {
    id: "sky",
    name: "Sky",
    blurb: "The original blue, with a clay accent.",
    light: {
        "brand": "#1777b8",
        "brandHover": "#005f9e",
        "onBrand": "#ffffff",
        "brandSoft": "#d6efff",
        "brandTint": "#edf8ff",
        "brandInk": "#005189",
        "accent": "#c47131",
        "onAccent": "#ffffff",
        "accentSoft": "#ffe7d2",
        "accentInk": "#863f00",
        "surface": "#ffffff",
        "surfaceMuted": "#f8fafc",
        "surfaceHover": "#f1f5f9",
        "border": "#e2e8f0",
        "borderSoft": "#f1f5f9",
        "borderStrong": "#c8d2df",
        "text": "#0f172a",
        "textMuted": "#64748b",
        "textSubtle": "#7e8da3",
        "ground": "#f8fafc"
  },
    dark: {
        "brand": "#5ca5e1",
        "brandHover": "#7cbbf0",
        "onBrand": "#13100d",
        "brandSoft": "#133047",
        "brandTint": "#132331",
        "brandInk": "#92cbfb",
        "accent": "#e69a64",
        "onAccent": "#13100d",
        "accentSoft": "#442916",
        "accentInk": "#fcbf95",
        "surface": "#161a26",
        "surfaceMuted": "#1c2030",
        "surfaceHover": "#232838",
        "border": "#232838",
        "borderSoft": "#1c2030",
        "borderStrong": "#343a58",
        "text": "#e2e8f0",
        "textMuted": "#94a3b8",
        "textSubtle": "#64748b",
        "ground": "#0b0d14"
  },
  },
  {
    id: "grounded",
    name: "Grounded",
    blurb: "Teal and clay. Steady.",
    light: {
        "brand": "#008974",
        "brandHover": "#00715e",
        "onBrand": "#ffffff",
        "brandSoft": "#cff5ec",
        "brandTint": "#ebfbf7",
        "brandInk": "#006150",
        "accent": "#c96b46",
        "onAccent": "#ffffff",
        "accentSoft": "#ffe5d7",
        "accentInk": "#8a3915",
        "surface": "#ffffff",
        "surfaceMuted": "#f8fafc",
        "surfaceHover": "#f1f5f9",
        "border": "#e2e8f0",
        "borderSoft": "#f1f5f9",
        "borderStrong": "#c8d2df",
        "text": "#0f172a",
        "textMuted": "#64748b",
        "textSubtle": "#7e8da3",
        "ground": "#f8fafc"
  },
    dark: {
        "brand": "#31b5a1",
        "brandHover": "#63c9b7",
        "onBrand": "#12100d",
        "brandSoft": "#00372f",
        "brandTint": "#0b2722",
        "brandInk": "#7ed8c6",
        "accent": "#eb9573",
        "onAccent": "#12100d",
        "accentSoft": "#46271c",
        "accentInk": "#ffbba0",
        "surface": "#161a26",
        "surfaceMuted": "#1c2030",
        "surfaceHover": "#232838",
        "border": "#232838",
        "borderSoft": "#1c2030",
        "borderStrong": "#343a58",
        "text": "#e2e8f0",
        "textMuted": "#94a3b8",
        "textSubtle": "#64748b",
        "ground": "#0b0d14"
  },
  },
  {
    id: "dusk",
    name: "Dusk",
    blurb: "Indigo and coral. The boldest of the set.",
    light: {
        "brand": "#6b64ba",
        "brandHover": "#554da0",
        "onBrand": "#ffffff",
        "brandSoft": "#e8e8ff",
        "brandTint": "#f5f5ff",
        "brandInk": "#48408b",
        "accent": "#cc6859",
        "onAccent": "#ffffff",
        "accentSoft": "#ffe4dd",
        "accentInk": "#8c352a",
        "surface": "#ffffff",
        "surfaceMuted": "#f8fafc",
        "surfaceHover": "#f1f5f9",
        "border": "#e2e8f0",
        "borderSoft": "#f1f5f9",
        "borderStrong": "#c8d2df",
        "text": "#0f172a",
        "textMuted": "#64748b",
        "textSubtle": "#7e8da3",
        "ground": "#f8fafc"
  },
    dark: {
        "brand": "#9794e3",
        "brandHover": "#adabf2",
        "onBrand": "#111014",
        "brandSoft": "#2b2948",
        "brandTint": "#201f32",
        "brandInk": "#bdbcfd",
        "accent": "#ee9182",
        "onAccent": "#111014",
        "accentSoft": "#462621",
        "accentInk": "#ffb8ab",
        "surface": "#161a26",
        "surfaceMuted": "#1c2030",
        "surfaceHover": "#232838",
        "border": "#232838",
        "borderSoft": "#1c2030",
        "borderStrong": "#343a58",
        "text": "#e2e8f0",
        "textMuted": "#94a3b8",
        "textSubtle": "#64748b",
        "ground": "#0b0d14"
  },
  },
  {
    id: "meadow",
    name: "Meadow",
    blurb: "Green and honey. Growing things.",
    light: {
        "brand": "#298646",
        "brandHover": "#006e30",
        "onBrand": "#ffffff",
        "brandSoft": "#d9f3dd",
        "brandTint": "#effaf0",
        "brandInk": "#005e26",
        "accent": "#b67c0d",
        "onAccent": "#ffffff",
        "accentSoft": "#ffebce",
        "accentInk": "#7b4800",
        "surface": "#ffffff",
        "surfaceMuted": "#f8fafc",
        "surfaceHover": "#f1f5f9",
        "border": "#e2e8f0",
        "borderSoft": "#f1f5f9",
        "borderStrong": "#c8d2df",
        "text": "#0f172a",
        "textMuted": "#64748b",
        "textSubtle": "#7e8da3",
        "ground": "#f8fafc"
  },
    dark: {
        "brand": "#66b278",
        "brandHover": "#85c692",
        "onBrand": "#11110d",
        "brandSoft": "#17351f",
        "brandTint": "#152619",
        "brandInk": "#9ad5a5",
        "accent": "#d8a354",
        "onAccent": "#11110d",
        "accentSoft": "#3f2c10",
        "accentInk": "#f1c68b",
        "surface": "#161a26",
        "surfaceMuted": "#1c2030",
        "surfaceHover": "#232838",
        "border": "#232838",
        "borderSoft": "#1c2030",
        "borderStrong": "#343a58",
        "text": "#e2e8f0",
        "textMuted": "#94a3b8",
        "textSubtle": "#64748b",
        "ground": "#0b0d14"
  },
  },
  {
    id: "ember",
    name: "Ember",
    blurb: "Amber and deep brown. Lamplight.",
    light: {
        "brand": "#a75c00",
        "brandHover": "#8d4400",
        "onBrand": "#ffffff",
        "brandSoft": "#ffe6d1",
        "brandTint": "#fff4eb",
        "brandInk": "#7a3800",
        "accent": "#cc6660",
        "onAccent": "#ffffff",
        "accentSoft": "#ffe4df",
        "accentInk": "#8c3432",
        "surface": "#ffffff",
        "surfaceMuted": "#f8fafc",
        "surfaceHover": "#f1f5f9",
        "border": "#e2e8f0",
        "borderSoft": "#f1f5f9",
        "borderStrong": "#c8d2df",
        "text": "#0f172a",
        "textMuted": "#64748b",
        "textSubtle": "#7e8da3",
        "ground": "#f8fafc"
  },
    dark: {
        "brand": "#d28c50",
        "brandHover": "#e3a572",
        "onBrand": "#13100d",
        "brandSoft": "#42270e",
        "brandTint": "#2e1d10",
        "brandInk": "#f0b788",
        "accent": "#ee9089",
        "onAccent": "#13100d",
        "accentSoft": "#462623",
        "accentInk": "#ffb7b0",
        "surface": "#161a26",
        "surfaceMuted": "#1c2030",
        "surfaceHover": "#232838",
        "border": "#232838",
        "borderSoft": "#1c2030",
        "borderStrong": "#343a58",
        "text": "#e2e8f0",
        "textMuted": "#94a3b8",
        "textSubtle": "#64748b",
        "ground": "#0b0d14"
  },
  },
  {
    id: "plum",
    name: "Plum",
    blurb: "Violet and rose. Quiet but not grey.",
    light: {
        "brand": "#8e57a5",
        "brandHover": "#76408c",
        "onBrand": "#ffffff",
        "brandSoft": "#f6e4fe",
        "brandTint": "#fbf3ff",
        "brandInk": "#653579",
        "accent": "#cb6570",
        "onAccent": "#ffffff",
        "accentSoft": "#ffe3e5",
        "accentInk": "#8b333f",
        "surface": "#ffffff",
        "surfaceMuted": "#f8fafc",
        "surfaceHover": "#f1f5f9",
        "border": "#e2e8f0",
        "borderSoft": "#f1f5f9",
        "borderStrong": "#c8d2df",
        "text": "#0f172a",
        "textMuted": "#64748b",
        "textSubtle": "#7e8da3",
        "ground": "#f8fafc"
  },
    dark: {
        "brand": "#b988d0",
        "brandHover": "#cca1e0",
        "onBrand": "#120f13",
        "brandSoft": "#382541",
        "brandTint": "#281c2d",
        "brandInk": "#dab3ed",
        "accent": "#ed8f96",
        "onAccent": "#120f13",
        "accentSoft": "#462528",
        "accentInk": "#ffb6bb",
        "surface": "#161a26",
        "surfaceMuted": "#1c2030",
        "surfaceHover": "#232838",
        "border": "#232838",
        "borderSoft": "#1c2030",
        "borderStrong": "#343a58",
        "text": "#e2e8f0",
        "textMuted": "#94a3b8",
        "textSubtle": "#64748b",
        "ground": "#0b0d14"
  },
  },
  {
    id: "rose",
    name: "Rose",
    blurb: "Soft pink and sand. Gentle throughout.",
    light: {
        "brand": "#af4c60",
        "brandHover": "#95344a",
        "onBrand": "#ffffff",
        "brandSoft": "#ffe1e5",
        "brandTint": "#fff2f4",
        "brandInk": "#812a3e",
        "accent": "#be7620",
        "onAccent": "#ffffff",
        "accentSoft": "#ffe9d0",
        "accentInk": "#814300",
        "surface": "#ffffff",
        "surfaceMuted": "#f8fafc",
        "surfaceHover": "#f1f5f9",
        "border": "#e2e8f0",
        "borderSoft": "#f1f5f9",
        "borderStrong": "#c8d2df",
        "text": "#0f172a",
        "textMuted": "#64748b",
        "textSubtle": "#7e8da3",
        "ground": "#f8fafc"
  },
    dark: {
        "brand": "#db7f8e",
        "brandHover": "#ec99a6",
        "onBrand": "#140f0e",
        "brandSoft": "#452127",
        "brandTint": "#301a1e",
        "brandInk": "#f8acb7",
        "accent": "#e09e5b",
        "onAccent": "#140f0e",
        "accentSoft": "#422b13",
        "accentInk": "#f7c28f",
        "surface": "#161a26",
        "surfaceMuted": "#1c2030",
        "surfaceHover": "#232838",
        "border": "#232838",
        "borderSoft": "#1c2030",
        "borderStrong": "#343a58",
        "text": "#e2e8f0",
        "textMuted": "#94a3b8",
        "textSubtle": "#64748b",
        "ground": "#0b0d14"
  },
  },
  {
    id: "slate",
    name: "Slate",
    blurb: "Nearly no colour, for when you want none.",
    light: {
        "brand": "#5c7588",
        "brandHover": "#455e70",
        "onBrand": "#ffffff",
        "brandSoft": "#e4edf3",
        "brandTint": "#f3f7fa",
        "brandInk": "#3a5060",
        "accent": "#9f8273",
        "onAccent": "#ffffff",
        "accentSoft": "#f7ece6",
        "accentInk": "#674f42",
        "surface": "#ffffff",
        "surfaceMuted": "#f8fafc",
        "surfaceHover": "#f1f5f9",
        "border": "#e2e8f0",
        "borderSoft": "#f1f5f9",
        "borderStrong": "#c8d2df",
        "text": "#0f172a",
        "textMuted": "#64748b",
        "textSubtle": "#7e8da3",
        "ground": "#f8fafc"
  },
    dark: {
        "brand": "#8aa2b3",
        "brandHover": "#a3b7c7",
        "onBrand": "#12100f",
        "brandSoft": "#262f36",
        "brandTint": "#1d2227",
        "brandInk": "#b4c7d5",
        "accent": "#c2a89a",
        "onAccent": "#12100f",
        "accentSoft": "#372e29",
        "accentInk": "#dec9bd",
        "surface": "#161a26",
        "surfaceMuted": "#1c2030",
        "surfaceHover": "#232838",
        "border": "#232838",
        "borderSoft": "#1c2030",
        "borderStrong": "#343a58",
        "text": "#e2e8f0",
        "textMuted": "#94a3b8",
        "textSubtle": "#64748b",
        "ground": "#0b0d14"
  },
  },
  {
    id: "apricot",
    name: "Apricot",
    blurb: "Warm orange and turquoise. Soft, not loud.",
    light: {
        "brand": "#ba6f5c",
        "brandHover": "#a75d4b",
        "onBrand": "#ffffff",
        "brandSoft": "#fbddd5",
        "brandTint": "#fff1ed",
        "brandInk": "#934c3a",
        "accent": "#5ebdbc",
        "onAccent": "#13100d",
        "accentSoft": "#caedec",
        "accentInk": "#007272",
        "surface": "#ffffff",
        "surfaceMuted": "#f8fafc",
        "surfaceHover": "#f1f5f9",
        "border": "#e2e8f0",
        "borderSoft": "#f1f5f9",
        "borderStrong": "#c8d2df",
        "text": "#0f172a",
        "textMuted": "#64748b",
        "textSubtle": "#7e8da3",
        "ground": "#f8fafc"
  },
    dark: {
        "brand": "#b37363",
        "brandHover": "#c78575",
        "onBrand": "#13100d",
        "brandSoft": "#401e15",
        "brandTint": "#2a130d",
        "brandInk": "#cb8d7d",
        "accent": "#5aa7a7",
        "onAccent": "#13100d",
        "accentSoft": "#003333",
        "accentInk": "#6cb3b2",
        "surface": "#161a26",
        "surfaceMuted": "#1c2030",
        "surfaceHover": "#232838",
        "border": "#232838",
        "borderSoft": "#1c2030",
        "borderStrong": "#343a58",
        "text": "#e2e8f0",
        "textMuted": "#94a3b8",
        "textSubtle": "#64748b",
        "ground": "#0b0d14"
  },
  },
  {
    id: "citron",
    name: "Citron",
    blurb: "Olive and honey. Late summer.",
    light: {
        "brand": "#8e894a",
        "brandHover": "#7c7738",
        "onBrand": "#ffffff",
        "brandSoft": "#e7e6d0",
        "brandTint": "#f6f6ea",
        "brandInk": "#6b6626",
        "accent": "#dc9b64",
        "onAccent": "#13100d",
        "accentSoft": "#fadfc9",
        "accentInk": "#8e5318",
        "surface": "#ffffff",
        "surfaceMuted": "#f8fafc",
        "surfaceHover": "#f1f5f9",
        "border": "#e2e8f0",
        "borderSoft": "#f1f5f9",
        "borderStrong": "#c8d2df",
        "text": "#0f172a",
        "textMuted": "#64748b",
        "textSubtle": "#7e8da3",
        "ground": "#f8fafc"
  },
    dark: {
        "brand": "#8c8955",
        "brandHover": "#9f9b66",
        "onBrand": "#13100d",
        "brandSoft": "#2c2a0c",
        "brandTint": "#1d1b07",
        "brandInk": "#a4a16f",
        "accent": "#c18b5f",
        "onAccent": "#13100d",
        "accentSoft": "#402409",
        "accentInk": "#cc986e",
        "surface": "#161a26",
        "surfaceMuted": "#1c2030",
        "surfaceHover": "#232838",
        "border": "#232838",
        "borderSoft": "#1c2030",
        "borderStrong": "#343a58",
        "text": "#e2e8f0",
        "textMuted": "#94a3b8",
        "textSubtle": "#64748b",
        "ground": "#0b0d14"
  },
  },
  {
    id: "lagoon",
    name: "Lagoon",
    blurb: "Blue-green, with honey.",
    light: {
        "brand": "#1d97a3",
        "brandHover": "#008590",
        "onBrand": "#ffffff",
        "brandSoft": "#cbecf0",
        "brandTint": "#e8f9fb",
        "brandInk": "#00707c",
        "accent": "#d5a051",
        "onAccent": "#13100d",
        "accentSoft": "#f7e1c3",
        "accentInk": "#895700",
        "surface": "#ffffff",
        "surfaceMuted": "#f8fafc",
        "surfaceHover": "#f1f5f9",
        "border": "#e2e8f0",
        "borderSoft": "#f1f5f9",
        "borderStrong": "#c8d2df",
        "text": "#0f172a",
        "textMuted": "#64748b",
        "textSubtle": "#7e8da3",
        "ground": "#f8fafc"
  },
    dark: {
        "brand": "#3b959e",
        "brandHover": "#50a8b1",
        "onBrand": "#13100d",
        "brandSoft": "#003036",
        "brandTint": "#002023",
        "brandInk": "#5cadb6",
        "accent": "#bc8f4f",
        "onAccent": "#13100d",
        "accentSoft": "#3d2600",
        "accentInk": "#c79c61",
        "surface": "#161a26",
        "surfaceMuted": "#1c2030",
        "surfaceHover": "#232838",
        "border": "#232838",
        "borderSoft": "#1c2030",
        "borderStrong": "#343a58",
        "text": "#e2e8f0",
        "textMuted": "#94a3b8",
        "textSubtle": "#64748b",
        "ground": "#0b0d14"
  },
  },
  {
    id: "mulberry",
    name: "Mulberry",
    blurb: "Muted berry and turquoise. Quiet, with colour.",
    light: {
        "brand": "#af6d97",
        "brandHover": "#9c5c85",
        "onBrand": "#ffffff",
        "brandSoft": "#f6dceb",
        "brandTint": "#fef1f8",
        "brandInk": "#894b73",
        "accent": "#5ebdbc",
        "onAccent": "#13100d",
        "accentSoft": "#caedec",
        "accentInk": "#007272",
        "surface": "#ffffff",
        "surfaceMuted": "#f8fafc",
        "surfaceHover": "#f1f5f9",
        "border": "#e2e8f0",
        "borderSoft": "#f1f5f9",
        "borderStrong": "#c8d2df",
        "text": "#0f172a",
        "textMuted": "#64748b",
        "textSubtle": "#7e8da3",
        "ground": "#f8fafc"
  },
    dark: {
        "brand": "#aa7295",
        "brandHover": "#bd83a7",
        "onBrand": "#ffffff",
        "brandSoft": "#3b1d30",
        "brandTint": "#271320",
        "brandInk": "#c28bac",
        "accent": "#5aa7a7",
        "onAccent": "#13100d",
        "accentSoft": "#003333",
        "accentInk": "#6cb3b2",
        "surface": "#161a26",
        "surfaceMuted": "#1c2030",
        "surfaceHover": "#232838",
        "border": "#232838",
        "borderSoft": "#1c2030",
        "borderStrong": "#343a58",
        "text": "#e2e8f0",
        "textMuted": "#94a3b8",
        "textSubtle": "#64748b",
        "ground": "#0b0d14"
  },
  },
];

export const DEFAULT_THEME_ID = "sky";

/** Status colours, shared by every theme. See note 3. */
/** Shared across every theme — exported so the contrast checker can
 *  test the real values rather than re-parsing this file. */
export const STATUS = {
  "light": {
    "success": "#1f7a4d",
    "onSuccess": "#ffffff",
    "successSoft": "#e3f4ea",
    "successInk": "#155f3b",
    "warning": "#96650a",
    "onWarning": "#ffffff",
    "warningSoft": "#fbeed6",
    "warningInk": "#7a5208",
    "danger": "#c4342f",
    "onDanger": "#ffffff",
    "dangerSoft": "#fbe6e4",
    "dangerInk": "#9c2621"
  },
  "dark": {
    "success": "#5cbf8a",
    "onSuccess": "#0f0d0b",
    "successSoft": "#173026",
    "successInk": "#8fd9b0",
    "warning": "#d9a447",
    "onWarning": "#0f0d0b",
    "warningSoft": "#332813",
    "warningInk": "#edc57e",
    "danger": "#e8756d",
    "onDanger": "#0f0d0b",
    "dangerSoft": "#331a19",
    "dangerInk": "#f4a49e"
  }
} as const;

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
}

/**
 * What a member who has never touched the setting gets.
 *
 * Dark. Not "system" — this is a place people open at 2am, and the
 * OS preference is a poor proxy for that: plenty of phones sit in
 * light mode all day because nobody ever changed it.
 *
 * Nothing is written to the database when this applies. A member with
 * no stored preference has NULL, and NULL means "whatever the app
 * decides" — so changing this line moves everyone who never chose,
 * which is the point of a default. Stamping "dark" onto rows at
 * signup would freeze today's answer into every account forever.
 */
export const DEFAULT_APPEARANCE_MODE: AppearanceMode = "dark";

/**
 * Read a stored preference.
 *
 * "system" IS A STORED VALUE, not the absence of one. That is the
 * difference this function turns on: before dark was the default,
 * NULL and "system" meant the same thing and the column only ever
 * held null; now "I want to follow my device" and "I never said" are
 * different answers and have to survive a round trip separately.
 *
 * Anything unrecognised — a value from a future version, a hand-edited
 * row — falls back to the default rather than throwing. A bad string
 * in this column should give somebody the wrong shade, not a 500.
 */
export function parseAppearanceMode(raw: string | null | undefined): AppearanceMode {
  return raw === "light" || raw === "dark" || raw === "system"
    ? raw
    : DEFAULT_APPEARANCE_MODE;
}

/**
 * What to put on the shell's data-appearance attribute.
 *
 * System resolves to null — the ABSENCE of the attribute is what lets
 * the prefers-color-scheme rule match, so "system" must not be
 * written as a value.
 */
export function appearanceAttribute(mode: AppearanceMode): "light" | "dark" | null {
  return mode === "system" ? null : mode;
}

/* ── tone ──────────────────────────────────────────────────────
 *
 * A second axis on top of the twelve palettes: WHICH colour, and then
 * HOW DEEP it runs. The member picks a theme, then picks a step from
 * lightest to darkest, and only the brand and accent families move —
 * the page, the cards and the text stay exactly where they are.
 *
 * It is five presets rather than a slider on purpose. A slider is a
 * thousand palettes nobody has checked; five is five, and
 * `npm run theme:check` walks every theme x mode x tone and refuses
 * to let a build through where any of them stops being readable.
 *
 * THE INTERESTING CONSTRAINT IS THE LIGHT END. `brand` is not only a
 * button fill — it is the colour of a link inside a paragraph. Below
 * 3:1 against the card a link stops looking like a link and becomes a
 * slightly odd word, so a lighter tone lightens as far as it is asked
 * to and then walks back exactly as far as legibility requires. That
 * is why "Lightest" is visibly paler on Grounded than on Citron: a
 * yellow-green runs out of contrast against white sooner than a teal
 * does, and the ramp respects that rather than pretending otherwise.
 */

export const TONE_LABELS = ["Lightest", "Light", "Default", "Deep", "Deepest"] as const;
export const DEFAULT_TONE = 2;

/** Lightness offsets in OKLCH, lightest first. */
const TONE_DELTAS = [0.1, 0.05, 0, -0.05, -0.1];

export function parseTone(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isInteger(n) && n >= 0 && n < TONE_DELTAS.length ? n : DEFAULT_TONE;
}

/* sRGB <-> OKLCH. Enough of it to move a colour's lightness without
   touching its hue, which is the whole job. */
const toLinear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toSrgb = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const clamp255 = (v: number) => Math.max(0, Math.min(255, v));

function hexOf(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(clamp255(v)).toString(16).padStart(2, "0")).join("");
}

function oklchToHex(L: number, C: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const bb = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
  return hexOf(
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  );
}

function hexToOklch(hex: string): { L: number; C: number; h: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = toLinear((n >> 16) & 255);
  const g = toLinear((n >> 8) & 255);
  const b = toLinear(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    C: Math.hypot(
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ),
    h:
      ((Math.atan2(
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      ) * 180) / Math.PI + 360) % 360,
  };
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * toLinear((n >> 16) & 255) +
    0.7152 * toLinear((n >> 8) & 255) +
    0.0722 * toLinear(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const NEAR_BLACK = "#13100d";

/**
 * Shift a palette's brand and accent families by one tone step.
 *
 * Everything derived is re-derived, never assumed: a light tone can
 * flip a button label from white to near-black, and the chip inks are
 * re-solved against the softs they now sit on.
 */
export function applyTone(tokens: ThemeTokens, step: number): ThemeTokens {
  const d = TONE_DELTAS[parseTone(step)];
  if (!d) return tokens;

  const shift = (hex: string, mult = 1) => {
    const o = hexToOklch(hex);
    return oklchToHex(Math.min(0.97, Math.max(0.12, o.L + d * mult)), o.C, o.h);
  };

  // Lighten as asked, then back off only as far as a link on a card
  // needs to stay findable. See the note above.
  const lightenButKeepFindable = (hex: string) => {
    const o = hexToOklch(hex);
    let L = Math.min(0.97, Math.max(0.12, o.L + d));
    while (L > 0.12 && contrast(oklchToHex(L, o.C, o.h), tokens.surface) < 3.05) L -= 0.004;
    return oklchToHex(L, o.C, o.h);
  };

  const brand = d > 0 ? lightenButKeepFindable(tokens.brand) : shift(tokens.brand);
  const brandHover = d > 0 ? lightenButKeepFindable(tokens.brandHover) : shift(tokens.brandHover);
  const accent = shift(tokens.accent);
  // The soft backgrounds follow at a fraction, so a deep tone doesn't
  // leave its chips looking bleached beside it.
  const brandSoft = shift(tokens.brandSoft, 0.35);
  const brandTint = shift(tokens.brandTint, 0.2);
  const accentSoft = shift(tokens.accentSoft, 0.35);

  const solveInk = (from: string, bg: string) => {
    const o = hexToOklch(from);
    const dir = luminance(bg) > 0.35 ? -1 : 1;
    for (let L = o.L; L > 0.05 && L < 0.99; L += dir * 0.004) {
      const c = oklchToHex(L, o.C, o.h);
      if (contrast(c, bg) >= 4.6) return c;
    }
    return from;
  };

  let brandInk = solveInk(tokens.brandInk, brandSoft);
  if (contrast(brandInk, brandTint) < 4.5) brandInk = solveInk(brandInk, brandTint);

  return {
    ...tokens,
    brand,
    brandHover,
    accent,
    brandSoft,
    brandTint,
    accentSoft,
    brandInk,
    accentInk: solveInk(tokens.accentInk, accentSoft),
    onBrand:
      contrast("#ffffff", brand) >= 3 && contrast("#ffffff", brandHover) >= 3
        ? "#ffffff"
        : NEAR_BLACK,
    onAccent: contrast("#ffffff", accent) >= 3 ? "#ffffff" : NEAR_BLACK,
  };
}

/** The five swatches the picker shows, for one theme and mode. */
export function toneSwatches(themeId: string | null | undefined, mode: "light" | "dark"): string[] {
  const base = getTheme(themeId)[mode];
  return TONE_DELTAS.map((_, i) => applyTone(base, i).brand);
}

function block(tokens: ThemeTokens, mode: "light" | "dark"): string {
  const lines = [
    `  --color-brand: ${tokens.brand};`,
    `  --color-brand-hover: ${tokens.brandHover};`,
    `  --color-on-brand: ${tokens.onBrand};`,
    `  --color-brand-soft: ${tokens.brandSoft};`,
    `  --color-brand-tint: ${tokens.brandTint};`,
    `  --color-brand-ink: ${tokens.brandInk};`,
    `  --color-accent: ${tokens.accent};`,
    `  --color-on-accent: ${tokens.onAccent};`,
    `  --color-accent-soft: ${tokens.accentSoft};`,
    `  --color-accent-ink: ${tokens.accentInk};`,
    `  --color-surface: ${tokens.surface};`,
    `  --color-surface-elevated: ${tokens.surface};`,
    `  --color-surface-muted: ${tokens.surfaceMuted};`,
    `  --color-surface-hover: ${tokens.surfaceHover};`,
    `  --color-ground: ${tokens.ground};`,
    `  --color-border: ${tokens.border};`,
    `  --color-border-soft: ${tokens.borderSoft};`,
    `  --color-border-strong: ${tokens.borderStrong};`,
    `  --color-text: ${tokens.text};`,
    `  --color-text-muted: ${tokens.textMuted};`,
    `  --color-text-subtle: ${tokens.textSubtle};`,
    `  --color-success: ${STATUS[mode].success};`,
    `  --color-on-success: ${STATUS[mode].onSuccess};`,
    `  --color-success-soft: ${STATUS[mode].successSoft};`,
    `  --color-success-ink: ${STATUS[mode].successInk};`,
    `  --color-warning: ${STATUS[mode].warning};`,
    `  --color-on-warning: ${STATUS[mode].onWarning};`,
    `  --color-warning-soft: ${STATUS[mode].warningSoft};`,
    `  --color-warning-ink: ${STATUS[mode].warningInk};`,
    `  --color-danger: ${STATUS[mode].danger};`,
    `  --color-on-danger: ${STATUS[mode].onDanger};`,
    `  --color-danger-soft: ${STATUS[mode].dangerSoft};`,
    `  --color-danger-ink: ${STATUS[mode].dangerInk};`,
  ];
  return lines.join("\n");
}

/**
 * The CSS a signed-in member's page carries.
 *
 * Emitted on the server and injected into the layout, so the first
 * paint is already the right theme in the right mode — no flash of
 * something else while JavaScript catches up.
 *
 * Scoped through `#app-shell` the same way the rest of the app is:
 * that wrapper only exists on signed-in pages, so a member who likes
 * dark mode still sees the light brand on public pages, where there
 * is no preference to read.
 */
export function buildThemeStyleBlock(
  themeId: string | null | undefined,
  tone: number = DEFAULT_TONE,
): string {
  const t = getTheme(themeId);
  const light = applyTone(t.light, tone);
  const dark = applyTone(t.dark, tone);
  return [
    ":root {",
    block(light, "light"),
    "}",
    'html:has(#app-shell[data-appearance="dark"]) {',
    block(dark, "dark"),
    "}",
    "@media (prefers-color-scheme: dark) {",
    '  html:has(#app-shell:not([data-appearance="light"]):not([data-appearance="dark"])) {',
    block(dark, "dark"),
    "  }",
    "}",
  ].join("\n");
}
