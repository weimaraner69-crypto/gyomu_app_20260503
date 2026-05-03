// Jest 設定ファイル
import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // next.config.js と .env.local を読み込むパスを指定する
  dir: "./",
});

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};

export default createJestConfig(config);
