import { resetDedicatedE2EData } from "./staging-data";

export default async function globalTeardown() {
  await resetDedicatedE2EData();
}
