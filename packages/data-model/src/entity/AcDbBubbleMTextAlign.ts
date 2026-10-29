import {
  AcGiMTextAttachmentPoint,
  AcGiMTextData
} from '@mlightcad/graphic-interface'

import { acdbStripMTextControlCodes } from './AcDbTextExtentsHelpers'

/**
 * CAXA/ODA balloon callouts are often MTEXT + near-full ARC: DXF group 71 is
 * TopLeft (1) while the insert sits SW of the ring center. Honoring TopLeft
 * then places the digit off-center vs COM Plot. Detect the balloon idiom and
 * re-anchor the **display** copy to MiddleCenter at the ARC center — never
 * mutate Hub layout / dense-note algorithms.
 */

/** Arc candidate used only for balloon digit re-anchoring. */
export type AcDbBubbleArcCandidate = {
  cx: number
  cy: number
  cz: number
  r: number
}

/**
 * True when stripped MTEXT is a 1–2 digit balloon number (e.g. `\W1.2;11` → `11`).
 */
export function acdbPlainBubbleDigitLabel(contents: string): string | null {
  const plain = acdbStripMTextControlCodes(contents ?? '')
    .replace(/\s+/g, '')
    .trim()
  if (!/^\d{1,2}$/.test(plain)) return null
  return plain
}

/**
 * Pick the nearest balloon-sized ARC for a digit MTEXT insert.
 *
 * Jingche figband: height≈1.99, ARC r≈2.56 (r/h≈1.29); insert dist≈1.6.
 */
export function acdbPickBubbleArcCenter(
  arcs: ReadonlyArray<AcDbBubbleArcCandidate>,
  loc: { x: number; y: number },
  height: number
): AcDbBubbleArcCandidate | null {
  if (!(height > 0) || arcs.length === 0) return null
  const rMin = height * 0.9
  const rMax = height * 2.5
  let best: AcDbBubbleArcCandidate | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const arc of arcs) {
    if (!(arc.r >= rMin && arc.r <= rMax)) continue
    const dx = arc.cx - loc.x
    const dy = arc.cy - loc.y
    const dist = Math.hypot(dx, dy)
    // Insert is inside / near the ring, not a distant unrelated arc.
    if (dist > arc.r * 1.75) continue
    if (dist < bestDist) {
      bestDist = dist
      best = arc
    }
  }
  return best
}

/**
 * Display-only MiddleCenter snap to the balloon ARC center.
 * No-op when already MiddleCenter and insert is within ε of the center.
 */
export function acdbAlignBubbleMTextData(
  data: AcGiMTextData,
  center: AcDbBubbleArcCandidate,
  epsFactor: number = 0.05
): AcGiMTextData {
  const h = data.height
  const eps = h > 0 ? h * epsFactor : 1e-6
  const dx = data.position.x - center.cx
  const dy = data.position.y - center.cy
  const already =
    data.attachmentPoint === AcGiMTextAttachmentPoint.MiddleCenter &&
    Math.hypot(dx, dy) <= eps
  if (already) return data
  return {
    ...data,
    attachmentPoint: AcGiMTextAttachmentPoint.MiddleCenter,
    position: {
      x: center.cx,
      y: center.cy,
      z: data.position.z ?? center.cz
    }
  }
}
