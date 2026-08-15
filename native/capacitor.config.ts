import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.BALI_MOBILE_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "club.bali.mobile",
  appName: "BALI",
  webDir: "www",
  backgroundColor: "#080a0a",
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile"
  },
  android: {
    backgroundColor: "#080a0a"
  },
  ...(serverUrl ? {
    server: {
      url: serverUrl,
      cleartext: false,
      androidScheme: "https"
    }
  } : {})
};

export default config;
