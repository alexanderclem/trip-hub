import type { TripCover } from './presentation'

/** Local vector postcards: decorative, lightweight, and available without a connection. */
export function TripArtwork({ cover, className = '' }: { cover: TripCover; className?: string }) {
  if (cover === 'none') return null
  return <svg viewBox="0 0 600 240" fill="none" aria-hidden="true" className={`trip-artwork ${className}`} preserveAspectRatio="xMidYMid slice">
    <rect width="600" height="240" fill={cover === 'city' ? '#ecdcca' : '#d6e4e5'} />
    <circle cx={cover === 'mountains' ? 447 : 472} cy="62" r="28" fill="#ef9477" />
    {cover === 'coast' && <>
      <path d="M0 147 95 122 177 136 267 91 342 140 422 113 504 141 600 118V240H0Z" fill="#8eafb0" />
      <path d="M0 174Q160 139 300 167T600 162V240H0Z" fill="#547d87" />
      <path d="M0 210Q132 170 260 205T600 204V240H0Z" fill="#295361" />
      <path d="M330 187h74m-174 29h55m186-34h35M67 170h53" stroke="#d6e4e5" strokeWidth="2" strokeLinecap="round" />
      <path d="m370 155 19-37 2 37Z" fill="#fffdf8" /><path d="M364 160h39l-8 7h-23Z" fill="#183e4b" />
      <path d="M0 198q52-28 110-10l77 52H0Z" fill="#e6d6b9" />
      <path d="m65 188 8-53m-3 19q-13-22-34-13m34 13q6-28 30-25m-30 25q16-10 31 0" stroke="#295361" strokeWidth="5" strokeLinecap="round" />
    </>}
    {cover === 'mountains' && <>
      <path d="m0 194 127-137 107 121 104-154 162 166 100-70v120H0Z" fill="#8eafb0" />
      <path d="m87 100 40-43 39 44-29-9-12 13-14-13Zm213-21 38-55 54 55-36-12-17 15-17-17Z" fill="#fffdf8" />
      <path d="M0 240 221 94 368 240Z" fill="#547d87" /><path d="m182 120 39-26 39 40-31-12-14 12-12-13Z" fill="#d6e4e5" />
      <path d="M321 240 467 118 600 217v23Z" fill="#295361" />
      <path d="M0 226q124-25 234 5t366-12v21H0Z" fill="#183e4b" />
      <path d="M394 240q-7-19 27-38t39-38" stroke="#e6d6b9" strokeWidth="5" />
      <path d="m61 190 12-27 12 27Zm28 15 15-36 15 36Zm426-4 14-34 14 34Z" fill="#183e4b" />
    </>}
    {cover === 'city' && <>
      <path d="M0 208V98h58v110m6 0V68h65v140m6 0V105h61v103m184 0V83h70v125m7 0V122h59v86m7 0V53h77v155" fill="#c4bba8" />
      <path d="M126 240V117h90v123m9 0V87h85v153m11 0V129h88v111" fill="#547d87" />
      <path d="m118 118 53-36 53 36m-6-30 49-32 51 32m-6 42 51-35 53 35" fill="#295361" />
      <path d="M149 142h17v22h-17Zm29 0h17v22h-17Zm-29 37h17v22h-17Zm29 0h17v22h-17Zm69-67h17v22h-17Zm29 0h17v22h-17Zm-29 38h17v22h-17Zm29 0h17v22h-17Zm68 4h17v22h-17Zm29 0h17v22h-17Z" fill="#f8f5ee" />
      <path d="M0 229h600v11H0Z" fill="#183e4b" /><path d="M58 229v-35m465 35v-43" stroke="#295361" strokeWidth="5" />
      <circle cx="58" cy="178" r="28" fill="#8eafb0" /><circle cx="523" cy="167" r="34" fill="#8eafb0" />
      <path d="M247 240v-32a20 20 0 0 1 40 0v32" fill="#183e4b" />
      <path d="M353 198h42v6h-42Z" fill="#ef9477" />
    </>}
    {cover === 'countryside' && <>
      <path d="M0 163q113-92 249-18t351-36v131H0Z" fill="#9eb4a0" />
      <path d="M0 166q160 82 329-10t271 19v65H0Z" fill="#6e8e7a" />
      <path d="M0 230q155-82 308-15t292-1v26H0Z" fill="#295361" />
      <path d="M300 240q100-38 33-67t-9-44" stroke="#e6d6b9" strokeWidth="15" />
      <path d="M137 144h53v39h-53Z" fill="#fffdf8" /><path d="m129 146 34-28 35 28Z" fill="#b97659" /><path d="M157 162h13v21h-13Z" fill="#295361" />
      <path d="M83 178v-29m423 57v-43m-52-19v-27" stroke="#183e4b" strokeWidth="4" />
      <ellipse cx="83" cy="140" rx="16" ry="25" fill="#295361" /><ellipse cx="506" cy="153" rx="22" ry="34" fill="#183e4b" /><ellipse cx="454" cy="108" rx="13" ry="23" fill="#295361" />
    </>}
    <path d="m32 39 9-4 9 4m14-8 7-3 7 3" stroke="#295361" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
}
