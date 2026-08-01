import { resetDedicatedE2EData } from "./staging-data";

export default async function globalSetup() {
  await resetDedicatedE2EData();
}
