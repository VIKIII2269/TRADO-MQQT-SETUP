import mqtt from "mqtt";
import { config } from "../config";

/**
 * Creates and returns a configured MQTT client.
 * Handles reconnection automatically via `mqtt` package.
 */
export function createClient(): mqtt.MqttClient {
  // Use MQTT over secure connection if port is 8883 (standard TLS port)
  const isSecure = config.mqtt.port === 8883;
  const protocol = isSecure ? "mqtts" : "mqtt";
  const connectUrl = `${protocol}://${config.mqtt.host}:${config.mqtt.port}`;

  // MQTT connection options
  const options: mqtt.IClientOptions = {
    clientId: config.mqtt.clientId,
    clean: true, // Clean session (no persistent state)
    connectTimeout: 4000, // 4s timeout to establish connection
    username: config.mqtt.username,
    password: config.mqtt.password,
    reconnectPeriod: 1000, // Retry every 1s on disconnect
  };

  console.log(`Connecting to MQTT broker at ${connectUrl} with client ID: ${options.clientId}`);

  // Return the client object (will auto-reconnect on failure)
  return mqtt.connect(connectUrl, options);
}
