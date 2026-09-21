/** Bounded browser approximations. Generated texture is clipped back to SourceAlpha. */
export function WorkstationEffectPreviewFilters() {
  return <svg className="vw-effect-preview-defs" aria-hidden="true" focusable="false">
    <defs>
      <filter id="vw-effect-glitch" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.18" numOctaves="1" seed="6" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="B" result="shifted" />
        <feColorMatrix in="shifted" type="matrix" values="1.2 0 0 0 0  0 .92 0 0 0  0 0 1.2 0 0  0 0 0 1 0" result="colored" />
        <feComposite in="colored" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id="vw-effect-vhs" colorInterpolationFilters="sRGB">
        <feColorMatrix in="SourceGraphic" type="saturate" values="0.82" result="graded" />
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.72" numOctaves="1" seed="12" result="scanNoise" />
        <feComponentTransfer in="scanNoise" result="softNoise"><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
        <feComposite in="softNoise" in2="SourceAlpha" operator="in" result="maskedNoise" />
        <feBlend in="graded" in2="maskedNoise" mode="screen" result="vhs" />
        <feComposite in="vhs" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id="vw-effect-oldfilm" colorInterpolationFilters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values=".82 .12 .04 0 .04  .08 .72 .04 0 .02  .03 .10 .55 0 0  0 0 0 1 0" result="aged" />
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="19" result="grain" />
        <feComponentTransfer in="grain" result="lightGrain"><feFuncA type="linear" slope="0.12" /></feComponentTransfer>
        <feComposite in="lightGrain" in2="SourceAlpha" operator="in" result="maskedGrain" />
        <feBlend in="aged" in2="maskedGrain" mode="multiply" result="film" />
        <feComposite in="film" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id="vw-effect-grain" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="2" seed="42" result="grain" />
        <feComponentTransfer in="grain" result="strongGrain"><feFuncA type="linear" slope="0.24" /></feComponentTransfer>
        <feComposite in="strongGrain" in2="SourceAlpha" operator="in" result="maskedGrain" />
        <feBlend in="SourceGraphic" in2="maskedGrain" mode="screen" result="grained" />
        <feComposite in="grained" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id="vw-effect-bloom" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="glow" />
        <feComponentTransfer in="glow" result="softGlow"><feFuncA type="linear" slope="0.38" /></feComponentTransfer>
        <feComposite in="softGlow" in2="SourceAlpha" operator="in" result="maskedGlow" />
        <feBlend in="SourceGraphic" in2="maskedGlow" mode="screen" result="bloom" />
        <feComposite in="bloom" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id="vw-effect-neon" colorInterpolationFilters="sRGB">
        <feMorphology in="SourceAlpha" operator="erode" radius="2" result="inner" />
        <feComposite in="SourceGraphic" in2="inner" operator="out" result="edge" />
        <feColorMatrix in="edge" type="matrix" values=".15 0 0 0 0  0 .75 0 0 .08  0 0 1.45 0 .18  0 0 0 1 0" result="cyanEdge" />
        <feGaussianBlur in="cyanEdge" stdDeviation="1.4" result="glow" />
        <feBlend in="SourceGraphic" in2="glow" mode="screen" result="neon" />
        <feComposite in="neon" in2="SourceAlpha" operator="in" />
      </filter>
    </defs>
  </svg>;
}
