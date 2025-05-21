import mqtt from "mqtt";
import { config, INDICES, EXPIRY_DATES, STRIKE_RANGE } from "../config";
import * as utils from "../utils";

// Tracks all active subscriptions to avoid resubscription
export const activeSubscriptions = new Set<string>();

// Tracks whether we've received the first message for each index
export const isFirstIndexMessage = new Map<string, boolean>();

/**
 * Subscribes to all index topics on startup.
 */
export function subscribeToAllIndices(client: mqtt.MqttClient) {
  INDICES.forEach((indexName) => {
    const topic = `${config.app.indexPrefix}/${indexName}`;
    console.log(`Subscribing to index: ${topic}`);
    client.subscribe(topic);
    activeSubscriptions.add(topic);
  });
}

/**
 * Initializes tracking map for first-time ATM subscriptions per index.
 */
export function initializeFirstMessageTracking() {
  INDICES.forEach((indexName) => {
    isFirstIndexMessage.set(indexName, true);
  });
}

/**
 * Subscribes to CE and PE options around the ATM strike for a given index.
 */
export async function subscribeToOptionsForIndex(
  client: mqtt.MqttClient,
  indexName: string,
  atmStrike: number
) {
  console.log(`Subscribing to ${indexName} options around ATM ${atmStrike}`);

  const strikeDiff = utils.getStrikeDiff(indexName);
  const expiryDate = EXPIRY_DATES[indexName as keyof typeof EXPIRY_DATES];

  const strikes: number[] = [];
  for (let i = -STRIKE_RANGE; i <= STRIKE_RANGE; i++) {
    strikes.push(atmStrike + i * strikeDiff);
  }

  for (const strike of strikes) {
    for (const optionType of ["ce", "pe"] as const) {
      try {
        const token = await getOptionToken(indexName, strike, optionType);
        if (!token) continue;

        const topic = utils.getOptionTopic(indexName, token);

        if (!activeSubscriptions.has(topic)) {
          client.subscribe(topic);
          activeSubscriptions.add(topic);
          console.log(`Subscribed to option: ${topic}`);
        }
      } catch (err) {
        console.error(`Error subscribing to ${indexName} ${strike} ${optionType}:`, err);
      }
    }
  }
}

/**
 * Fetches the token number for a given option contract.
 */
export async function getOptionToken(
  indexName: string,
  strikePrice: number,
  optionType: "ce" | "pe"
): Promise<string | null> {
  try {
    const expiryDate = EXPIRY_DATES[indexName as keyof typeof EXPIRY_DATES];
    const url = `https://api.trado.trade/token?index=${indexName}&expiryDate=${expiryDate}&optionType=${optionType}&strikePrice=${strikePrice}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`API returned status ${res.status}`);
    }

    const data = await res.json();

    if (data?.token) {
      return data.token;
    }

    console.warn(`No token found in response for ${indexName} ${strikePrice} ${optionType}`);
    return null;
  } catch (error) {
    console.error(
      `Error fetching token for ${indexName} ${strikePrice} ${optionType}:`,
      error
    );
    return null;
  }
}
