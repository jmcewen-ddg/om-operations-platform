// src/constants/districts.ts
export type District = {
  code: string   // value stored in om_request.district
  name: string   // display label
}

export const DISTRICTS: District[] = [
  { code: '02E', name: '02 East' },
  { code: '02W', name: '02 West' },
  { code: '03N', name: '03 North' },
  { code: '03S', name: '03 South' },
  { code: '04E', name: '04 East' },
  { code: '04W', name: '04 West' },
  { code: '05E', name: '05 East' },
  { code: '05W', name: '05 West' },
  { code: '07N', name: '07 North' },
  { code: '07S', name: '07 South' },
  { code: '08N', name: '08 North' },
  { code: '08S', name: '08 South' },
  { code: '58N', name: '58 North' },
  { code: '58S', name: '58 South' },
  { code: '61N', name: '61 North' },
  { code: '61S', name: '61 South' },
  { code: '62E', name: '62 East' },
  { code: '62W', name: '62 West' },
]

export const districtName = (code: string | null | undefined): string => {
  const d = DISTRICTS.find((d) => d.code === code)
  return d ? d.name : code ?? '—'
}