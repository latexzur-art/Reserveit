"use client";

import setupLocatorUI from "@locator/runtime";
import { useEffect } from "react";

export function LocatorInit() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      setupLocatorUI();
    }
  }, []);

  return null;
}
