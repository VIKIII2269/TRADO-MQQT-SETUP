import mqtt from "mqtt";
import * as marketdata from "../proto/market_data_pb";
import * as subscriptionManager from "./subscriptionManager";
import * as db from "../db";
import * as utils from "../utils";

// Map to store last seen LTP for each index
const indexLtpMap = new Map<string, number>();

// Map to store whether ATM strike has already been processed
const atmStrikeMap = new Map<string, number>();

/**
 * Processes a single MQTT message.
 * Decodes MarketData / MarketDataBatch / JSON format.
 * Stores LTP values and subscribes to options around ATM once per index.
 */
export function processMessage(
  topic: string,
  message: Buffer,
  client: mqtt.MqttClient
) {
  try {
    let decoded: any = null;
    let ltpValues: number[] = [];

    // Attempt Protobuf decoding
    try {
      decoded = marketdata.marketdata.MarketData.decode(new Uint8Array(message));
      if (decoded && typeof decoded.ltp === "number") {
        ltpValues.push(decoded.ltp);
      }
    } catch {
      try {
        decoded = marketdata.marketdata.MarketDataBatch.decode(new Uint8Array(message));
        if (decoded && Array.isArray(decoded.data)) {
          ltpValues = decoded.data
            .map((d: any) => d.ltp)
            .filter((v: any) => typeof v === "number");
        }
      } catch {
        try {
          decoded = JSON.parse(message.toString());
          if (decoded && typeof decoded.ltp === "number") {
            ltpValues.push(decoded.ltp);
          }
        } catch (jsonErr) {
          console.error("Failed to decode message for topic:", topic, jsonErr);
          return;
        }
      }
    }

    // Topic example: "index/NIFTY" or "NSE_FO|123456"
    const isIndexTopic = topic.startsWith("index/");
    const indexName = isIndexTopic ? topic.split("/")[1].toUpperCase() : undefined;

    for (const ltp of ltpValues) {
      if (isIndexTopic && indexName) {
        indexLtpMap.set(indexName, ltp);

        // Only compute and subscribe once per index
        if (!atmStrikeMap.has(indexName)) {
          const atmStrike = utils.getAtmStrike(indexName, ltp);
          atmStrikeMap.set(indexName, atmStrike);

          console.log(`[${indexName}] LTP = ${ltp} | ATM = ${atmStrike}`);
          subscriptionManager.subscribeToOptionsForIndex(client, indexName, atmStrike);
        }

        // Save index LTP to DB
        db.saveToDatabase(topic, ltp, indexName, "index", undefined);
      } else {
        // Non-index topics (like options), token will be extracted from topic
        const token = topic.split("|")[1];
        if (!token) {
          console.warn(`Invalid topic format (expected NSE_FO|<token>): ${topic}`);
          continue;
        }

        db.saveToDatabase(topic, ltp, undefined, "option", undefined);
      }
    }
  } catch (error) {
    console.error("Error processing message:", error);
  }
}
