import { acdbHostApplicationServices, AcDbDxfFiler } from '../src/base'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbLinetypeTableRecord } from '../src/database/AcDbLinetypeTableRecord'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbLinetypeTableRecord', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(
      () =>
        new AcDbLinetypeTableRecord({
          name: 'CONTINUOUS',
          standardFlag: 0,
          description: '',
          totalPatternLength: 0
        })
    )
  })

  it('clears ODA-spurious complex flags that have no shape/text', () => {
    const record = new AcDbLinetypeTableRecord({
      name: 'CENTER',
      standardFlag: 0,
      description: 'Center ____ _ ____',
      totalPatternLength: 47.4,
      pattern: [
        {
          elementLength: 22,
          elementTypeFlag: 4,
          shapeNumber: 0,
          styleObjectId: '0'
        },
        {
          elementLength: -8.5,
          elementTypeFlag: 4,
          shapeNumber: 0,
          styleObjectId: '0'
        },
        {
          elementLength: 8.5,
          elementTypeFlag: 4,
          shapeNumber: 0,
          styleObjectId: '0'
        },
        {
          elementLength: -8.5,
          elementTypeFlag: 4,
          shapeNumber: 0,
          styleObjectId: '0'
        }
      ]
    })

    const pattern = record.linetype.pattern ?? []
    expect(pattern.map(p => p.elementTypeFlag)).toEqual([0, 0, 0, 0])
    expect(pattern.map(p => p.elementLength)).toEqual([22, -8.5, 8.5, -8.5])
  })

  it('keeps complex flags when shape or text content is present', () => {
    const normalized = AcDbLinetypeTableRecord.normalizePatternElements([
      {
        elementLength: -1,
        elementTypeFlag: 2,
        text: 'A'
      },
      {
        elementLength: -1,
        elementTypeFlag: 4,
        shapeNumber: 12,
        styleObjectId: 'ABC'
      }
    ])
    expect(normalized[0].elementTypeFlag).toBe(2)
    expect(normalized[1].elementTypeFlag).toBe(4)
  })

  it('renders solid linetype preview as a single SVG line', () => {
    const record = new AcDbLinetypeTableRecord({
      name: 'CONTINUOUS',
      standardFlag: 0,
      description: 'Solid line',
      totalPatternLength: 0
    })

    const svg = record.toPreviewSvgString({
      width: 120,
      height: 24,
      padding: 6,
      stroke: '#000000'
    })

    expect(svg).toContain('<svg')
    expect(svg).toContain('width="120"')
    expect(svg).toContain('height="24"')
    expect((svg.match(/<line /g) ?? []).length).toBe(1)
    expect((svg.match(/<circle /g) ?? []).length).toBe(0)
  })

  it('renders dashed and dotted linetype preview with multiple segments', () => {
    const record = new AcDbLinetypeTableRecord({
      name: 'CENTER',
      standardFlag: 0,
      description: 'Center line',
      totalPatternLength: 0.9,
      pattern: [
        { elementLength: 0.5, elementTypeFlag: 0 },
        { elementLength: -0.3, elementTypeFlag: 0 },
        { elementLength: 0, elementTypeFlag: 0 },
        { elementLength: -0.1, elementTypeFlag: 0 }
      ]
    })

    const svg = record.toPreviewSvgString({
      width: 180,
      height: 30,
      padding: 10,
      repeats: 3
    })

    expect((svg.match(/<line /g) ?? []).length).toBeGreaterThan(1)
    expect((svg.match(/<circle /g) ?? []).length).toBeGreaterThan(0)
  })

  it('omits complex linetype extras for simple dash elements', () => {
    const record = new AcDbLinetypeTableRecord({
      name: 'DASHED',
      standardFlag: 0,
      description: 'Dashed',
      totalPatternLength: 0.8,
      pattern: [
        { elementLength: 0.5, elementTypeFlag: 0 },
        { elementLength: -0.3, elementTypeFlag: 0 }
      ]
    })
    record.ownerId = '0'

    const filer = new AcDbDxfFiler()
    record.dxfOutFields(filer)
    const dxf = filer.toString()

    expect(dxf).toContain('49\n0.5\n')
    expect(dxf).toContain('74\n0\n')
    expect(dxf).not.toContain('\n75\n')
    expect(dxf).not.toContain('\n340\n')
    expect(dxf).not.toContain('\n46\n')
    expect(dxf).not.toContain('\n9\n')
  })

  it('writes complex linetype shape/text extras and round-trips through dxfIn', () => {
    const record = new AcDbLinetypeTableRecord({
      name: 'GAS_LINE',
      standardFlag: 0,
      description: 'Gas line ----GAS----GAS----GAS----',
      totalPatternLength: 1.5,
      pattern: [
        { elementLength: 0.5, elementTypeFlag: 0 },
        { elementLength: -0.2, elementTypeFlag: 0 },
        {
          elementLength: 0,
          elementTypeFlag: 2,
          shapeNumber: 0,
          styleObjectId: '4F',
          scale: 0.1,
          rotation: 0,
          offsetX: -0.05,
          offsetY: -0.05,
          text: 'GAS'
        },
        { elementLength: -0.25, elementTypeFlag: 0 }
      ]
    })
    record.ownerId = '0'

    const outFiler = new AcDbDxfFiler()
    record.dxfOutFields(outFiler)
    const body = outFiler.toString()

    expect(body).toContain('74\n2\n')
    expect(body).toContain('75\n0\n')
    expect(body).toContain('340\n4F\n')
    expect(body).toContain('46\n0.1\n')
    expect(body).toContain('9\nGAS\n')

    const db = new AcDbDatabase()
    db.createDefaultData()
    acdbHostApplicationServices().workingDatabase = db

    const dxf = ['0', 'LTYPE', '5', '1A', body, '0', 'ENDTAB'].join('\n')
    const roundTrip = new AcDbLinetypeTableRecord()
    const inFiler = AcDbDxfFiler.fromString(dxf, { database: db })
    expect(inFiler.readItem()?.value).toBe('LTYPE')
    roundTrip.dxfIn(inFiler)

    expect(roundTrip.name).toBe('GAS_LINE')
    expect(roundTrip.comments).toBe('Gas line ----GAS----GAS----GAS----')
    expect(roundTrip.patternLength).toBeCloseTo(1.5)
    expect(roundTrip.linetype.pattern).toEqual([
      { elementLength: 0.5, elementTypeFlag: 0 },
      { elementLength: -0.2, elementTypeFlag: 0 },
      {
        elementLength: 0,
        elementTypeFlag: 2,
        shapeNumber: 0,
        styleObjectId: '4F',
        scale: 0.1,
        rotation: 0,
        offsetX: -0.05,
        offsetY: -0.05,
        text: 'GAS'
      },
      { elementLength: -0.25, elementTypeFlag: 0 }
    ])
  })
})
