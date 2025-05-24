export type OptionType = "CE" | "PE";

/**
 * Single time-series data point
 */
export interface TimeSeriesPoint {
  time: Date;
  ltp: number;
}

/**
 * Represents a single leg trade
 */
export interface Trade {
  index: string;
  date: string;
  entryTime: Date;
  exitTime: Date;
  strikePrice: number;
  optionType: OptionType;
  entryLtp: number;
  exitLtp: number;
  pnlPercent: number;      // percentage PnL relative to entry
  exitedBy: "SL" | "Target" | "Time" | "Combined" | "ReEntryExit";
}

/**
 * Collection of CE + PE positions for one cycle
 */
export interface Position {
  ce?: Trade;
  pe?: Trade;
  combinedPnlPercent: number;
  status: "OPEN" | "CLOSED";
  reEntered: boolean;
}

