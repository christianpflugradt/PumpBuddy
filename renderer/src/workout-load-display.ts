export const LOAD_DISPLAY_DECIMAL_PLACES = 2;

const roundLoadForDisplay = (value: number): number =>
  Math.round((value + Number.EPSILON) * 10 ** LOAD_DISPLAY_DECIMAL_PLACES) / 10 ** LOAD_DISPLAY_DECIMAL_PLACES;

const formatDisplayNumber = (value: number): string => {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(LOAD_DISPLAY_DECIMAL_PLACES).replace(/\.?0+$/, "");
};

export const formatLoadDisplayNumber = (loadValue: number | null): string | null => {
  if (loadValue === null || !Number.isFinite(loadValue)) {
    return null;
  }

  return formatDisplayNumber(roundLoadForDisplay(loadValue));
};

export const formatLoadInputDisplay = (loadValue: number | null): string =>
  formatLoadDisplayNumber(loadValue) ?? "";

export const formatLoadWithUnitDisplay = (loadValue: number | null): string => {
  const formatted = formatLoadDisplayNumber(loadValue);
  if (formatted === null) {
    return "—";
  }

  return `${formatted} kg`;
};
