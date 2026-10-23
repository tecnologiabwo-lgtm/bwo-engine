/** Tokens de marca Big Way Offices. El Consolidador conserva su propio CSS
 *  (clases semánticas) y por eso queda fuera de "content". */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
    "!./src/modules/consolidador/**",
  ],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      fontFamily: {
        sans: ["Archivo", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      colors: {
        bwo: {
          ink: "#191A3E",
          inkDeep: "#0D0B2E",
          violet: "#6C3BF5",
          violetLt: "#A78BFA",
          violetDk: "#4C1D95",
          cerise: "#E6197E",
          ceriseLt: "#F472B6",
          turquoise: "#22D3C5",
          turquoiseLt: "#5EEAD4",
          amber: "#F5A623",
        },
      },
    },
  },
  plugins: [],
};
