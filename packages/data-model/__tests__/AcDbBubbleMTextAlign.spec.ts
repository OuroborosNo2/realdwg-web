import { AcGiMTextAttachmentPoint } from '@mlightcad/graphic-interface'

import {
  acdbAlignBubbleMTextData,
  acdbPickBubbleArcCenter,
  acdbPlainBubbleDigitLabel
} from '../src/entity/AcDbBubbleMTextAlign'

describe('AcDbBubbleMTextAlign', () => {
  it('acdbPlainBubbleDigitLabel strips width factor and accepts 1–2 digits', () => {
    expect(acdbPlainBubbleDigitLabel('\\W3.3469;1')).toBe('1')
    expect(acdbPlainBubbleDigitLabel('\\W1.7188;11')).toBe('11')
    expect(acdbPlainBubbleDigitLabel('\\W1.1953;2')).toBe('2')
    expect(acdbPlainBubbleDigitLabel('104719')).toBe(null)
    expect(acdbPlainBubbleDigitLabel('R3')).toBe(null)
    expect(acdbPlainBubbleDigitLabel('')).toBe(null)
  })

  it('acdbPickBubbleArcCenter matches jingche-like balloon geometry', () => {
    const height = 1.993097822567645
    const arcs = [
      { cx: -63.2306, cy: 37.4388, cz: 0, r: 2.5626 },
      { cx: 100, cy: 100, cz: 0, r: 2.5 } // far
    ]
    // insert SW of center (CAXA TopLeft pattern)
    const picked = acdbPickBubbleArcCenter(
      arcs,
      { x: -63.9331, y: 36.0455 },
      height
    )
    expect(picked).not.toBeNull()
    expect(picked!.cx).toBeCloseTo(-63.2306, 3)
    expect(picked!.cy).toBeCloseTo(37.4388, 3)
  })

  it('acdbPickBubbleArcCenter rejects wrong radius band', () => {
    const picked = acdbPickBubbleArcCenter(
      [{ cx: 0, cy: 0, cz: 0, r: 20 }],
      { x: 0.1, y: -0.1 },
      2
    )
    expect(picked).toBeNull()
  })

  it('acdbAlignBubbleMTextData snaps TopLeft insert to MiddleCenter at ARC', () => {
    const aligned = acdbAlignBubbleMTextData(
      {
        text: '\\W1.1953;2',
        height: 2,
        width: 0,
        position: { x: -1, y: -1.4, z: 0 },
        attachmentPoint: AcGiMTextAttachmentPoint.TopLeft
      },
      { cx: 0, cy: 0, cz: 0, r: 2.5 }
    )
    expect(aligned.attachmentPoint).toBe(
      AcGiMTextAttachmentPoint.MiddleCenter
    )
    expect(aligned.position.x).toBe(0)
    expect(aligned.position.y).toBe(0)
    expect(aligned.text).toBe('\\W1.1953;2')
  })

  it('acdbAlignBubbleMTextData is no-op when already concentric MiddleCenter', () => {
    const data = {
      text: '3',
      height: 2,
      width: 0,
      position: { x: 1, y: 2, z: 0 },
      attachmentPoint: AcGiMTextAttachmentPoint.MiddleCenter
    }
    const aligned = acdbAlignBubbleMTextData(data, {
      cx: 1,
      cy: 2,
      cz: 0,
      r: 2.5
    })
    expect(aligned).toBe(data)
  })
})
