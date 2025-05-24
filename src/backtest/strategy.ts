import { TimeSeriesPoint, Trade, Position, OptionType } from './types';

/**
 * Simulates the BANKNIFTY CE+PE intraday strategy for one trading day
 */
export function simulateBankNiftyStrategy(
  ceSeries: TimeSeriesPoint[],
  peSeries: TimeSeriesPoint[],
  reEntryAllowed: boolean = true
): Position[] {
  const positions: Position[] = [];
  let position: Position = {
    combinedPnlPercent: 0,
    status: 'OPEN',
    reEntered: false,
  };

  // Entry at first timestamp
  const entryTime = ceSeries[0].time;
  const entryCeLtp = ceSeries[0].ltp;
  const entryPeLtp = peSeries[0].ltp;
  const ceTrade: Trade = {
    index: 'BANKNIFTY',
    date: entryTime.toDateString(),
    entryTime,
    exitTime: entryTime,
    strikePrice: 0, // filled externally
    optionType: 'CE',
    entryLtp: entryCeLtp,
    exitLtp: entryCeLtp,
    pnlPercent: 0,
    exitedBy: 'Time',
  };
  const peTrade: Trade = { ...ceTrade, optionType: 'PE', entryLtp: entryPeLtp, exitLtp: entryPeLtp };
  position.ce = ceTrade;
  position.pe = peTrade;

  // Compute thresholds
  const ceSl = entryCeLtp * 0.75;
  const peSl = entryPeLtp * 0.75;
  const combinedTarget = (entryCeLtp + entryPeLtp) * 1.25;
  const combinedSl = (entryCeLtp + entryPeLtp) * 0.90;

  // Iterate through each minute
  for (let i = 1; i < ceSeries.length; i++) {
    const time = ceSeries[i].time;
    const ceLtp = ceSeries[i].ltp;
    const peLtp = peSeries[i]?.ltp;

    // Check individual SL
    if (position.ce && position.ce.exitTime === position.ce.entryTime && ceLtp <= ceSl) {
      position.ce.exitTime = time;
      position.ce.exitLtp = ceLtp;
      position.ce.pnlPercent = ((ceLtp - entryCeLtp) / entryCeLtp) * 100;
      position.ce.exitedBy = 'SL';
    }
    if (position.pe && position.pe.exitTime === position.pe.entryTime && peLtp <= peSl) {
      position.pe.exitTime = time;
      position.pe.exitLtp = peLtp;
      position.pe.pnlPercent = ((peLtp - entryPeLtp) / entryPeLtp) * 100;
      position.pe.exitedBy = 'SL';
    }

    // Combined target/SL
    const totalValue = (position.ce.exitLtp || ceLtp) + (position.pe.exitLtp || peLtp!);
    if (position.ce.exitTime === position.ce.entryTime && position.pe.exitTime === position.pe.entryTime) {
      if (totalValue >= combinedTarget) {
        // exit both for target
        position.ce.exitTime = time;
        position.pe.exitTime = time;
        position.ce.exitLtp = ceLtp;
        position.pe.exitLtp = peLtp!;
        position.ce.pnlPercent = ((ceLtp - entryCeLtp) / entryCeLtp) * 100;
        position.pe.pnlPercent = ((peLtp! - entryPeLtp) / entryPeLtp) * 100;
        position.ce.exitedBy = 'Target';
        position.pe.exitedBy = 'Target';
      } else if (totalValue <= combinedSl) {
        // exit both for combined SL
        position.ce.exitTime = time;
        position.pe.exitTime = time;
        position.ce.exitLtp = ceLtp;
        position.pe.exitLtp = peLtp!;
        position.ce.pnlPercent = ((ceLtp - entryCeLtp) / entryCeLtp) * 100;
        position.pe.pnlPercent = ((peLtp! - entryPeLtp) / entryPeLtp) * 100;
        position.ce.exitedBy = 'Combined';
        position.pe.exitedBy = 'Combined';
      }
    }

    // Time-based exit at last timestamp
    if (i === ceSeries.length - 1) {
      if (position.ce.exitTime === entryTime) {
        position.ce.exitTime = time;
        position.ce.exitLtp = ceLtp;
        position.ce.pnlPercent = ((ceLtp - entryCeLtp) / entryCeLtp) * 100;
        position.ce.exitedBy = 'Time';
      }
      if (position.pe.exitTime === entryTime) {
        position.pe.exitTime = time;
        position.pe.exitLtp = peLtp!;
        position.pe.pnlPercent = ((peLtp! - entryPeLtp) / entryPeLtp) * 100;
        position.pe.exitedBy = 'Time';
      }
    }

    // Check if both closed before re-entry cutoff and re-entry allowed
    const cutoff = new Date(entryTime);
    cutoff.setHours(14, 0, 0);
    if (
      position.ce.exitTime < cutoff &&
      position.pe.exitTime < cutoff &&
      reEntryAllowed &&
      !position.reEntered
    ) {
      // will handle re-entry externally
      position.status = 'CLOSED';
    }

    // Once both exited mark closed
    if (
      position.ce.exitTime !== entryTime &&
      position.pe.exitTime !== entryTime &&
      position.status !== 'CLOSED'
    ) {
      position.status = 'CLOSED';
    }

    if (position.status === 'CLOSED') {
      position.combinedPnlPercent = (position.ce.pnlPercent || 0) + (position.pe.pnlPercent || 0);
      positions.push(position);

      // Reset for potential re-entry
      if (position.ce.exitTime < cutoff && position.pe.exitTime < cutoff && reEntryAllowed) {
        position.reEntered = true;
        break; // external runner will handle re-entry
      }
      break; // no re-entry
    }
  }

  return positions;
}

