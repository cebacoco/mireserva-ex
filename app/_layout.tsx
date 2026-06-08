import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CartProvider } from "./lib/cartStore";

import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

SplashScreen.preventAutoHideAsync().catch(() => {});

if (typeof globalThis.fetch === "undefined") {
  // @ts-ignore
  globalThis.fetch = fetch;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <CartProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#F8FAFC" },
        }}
      />
    </CartProvider>
  );
}
