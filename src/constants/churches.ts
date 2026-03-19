export const CHURCH_OPTIONS = [
  { label: 'Tampa Bay ICC', value: 'tampa_bay' },
  { label: 'Miami ICC', value: 'miami' },
  { label: 'Orlando ICC', value: 'orlando' },
  { label: 'Gainesville ICC', value: 'gainesville' },
  { label: 'Other', value: 'other' },
] as const;

export const getChurchLabel = (value?: string | null) =>
  CHURCH_OPTIONS.find((option) => option.value === value)?.label || '';
