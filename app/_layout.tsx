import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CartProvider } from "./lib/cartStore";
import React from "react";

// Polyfill fetch for environments where it's not available natively

if (typeof globalThis.fetch === 'undefined') {
  // @ts-ignore
  globalThis.fetch = fetch;
}

export default function RootLayout() {
  return (
    <CartProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F8FAFC' },
        }}
      />
    </CartProvider>
  );
}
