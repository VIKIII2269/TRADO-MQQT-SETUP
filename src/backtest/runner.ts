// -----------------------------
// src/backtest/runner.ts
// -----------------------------
import { getIndexLtpAt, getLtpSeries } from './dataLoader';
import { simulateBankNiftyStrategy } from './strategy';
import { OptionType } from './types';
import { config } from '../config';
import { getOptionToken } from '../mqtt/subscriptionManager';
import * as utils from '../utils';

(async () => {
  try {
    // Define the trading day and time window
    const tradeDate = new Date();
    tradeDate.setHours(9, 25, 0, 0); // 9:25 AM today
    const startTime = new Date(tradeDate);
    const endTime = new Date(tradeDate);
    endTime.setHours(15, 15, 0, 0); // 3:15 PM

    // 1. Fetch BANKNIFTY index LTP at 9:25 AM from TimescaleDB
    const idxLtp = await getIndexLtpAt('BANKNIFTY', startTime);

    // 2. Compute ATM strike using utility
    const atmStrike = utils.getAtmStrike('BANKNIFTY', idxLtp);
    console.log(`BANKNIFTY LTP at 9:25 = ${idxLtp} | ATM Strike = ${atmStrike}`);

    // 3. Fetch option tokens for CE and PE at ATM strike
    const ceToken = await getOptionToken('BANKNIFTY', atmStrike, 'ce');
    const peToken = await getOptionToken('BANKNIFTY', atmStrike, 'pe');
    if (!ceToken || !peToken) {
      throw new Error('Failed to fetch CE or PE token');
    }

    // 4. Load minute-wise price series for CE and PE
    const ceSeries = await getLtpSeries(ceToken, startTime, endTime);
    const peSeries = await getLtpSeries(peToken, startTime, endTime);

    console.log(`Loaded CE series: ${ceSeries.length} points`);
    console.log(`Loaded PE series: ${peSeries.length} points`);

    if (!ceSeries.length || !peSeries.length) {
      console.error('No LTP data found for CE or PE. Cannot run backtest.');
      return;
    }

    // 5. Run the strategy simulation (with optional one re-entry)
    const results = simulateBankNiftyStrategy(ceSeries, peSeries, true);
    console.log('Backtest results:', JSON.stringify(results, null, 2));

    // (Optional) Handle re-entry logic if flagged by strategy
    // Example: if (results.length && results[0].reEntered) { ... }
  } catch (err) {
    console.error('Backtest runner error:', err);
  } finally {
    process.exit(0);
  }
})();
